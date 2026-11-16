Build the back end for Putt Club's online play: two to four signed-in Warden Chat players in a room, joined by a 5-letter code, playing the same mini golf holes at the same time from their own devices. The server deals the holes and relays everyone's putts and scores; each device replays the others' putts with the game's own physics.

The full contract is pasted below this prompt, between the two `=====` lines (it is also `projects/putt-club/docs/ONLINE-PUTT.md` in `sirsc104-debug/wardenchat`, branch `claude/epic-bell-0rhxfv`). Read it fully first and build exactly what it specifies: names, parameters, JSON keys and error codes. The game's front end (`projects/putt-club/js/online.js`) is already built against it, so don't change the interface; if something in it can't work, stop and say what and why.

Where to start: `main` in `sirsc104-debug/warden-chat` does not have the game migrations. They are on the `codex/*` branches, which match what is live: start a new branch `codex/putt-club` from `codex/sirsc-equipped` (it has the SirSC economy, Downhill Death Run, Wildcard Chess economy and online, the casino and `sirsc_equip`), and note that Downhill Death Run's Turkey Trot migration (`20261104032142`) is only on `codex/sirsc-economy`. Give the new migration a timestamp after every existing one, and run `supabase migration list` against the live project before deploying so nothing already there is redone or skipped. Don't redefine `sirsc_me`, `sirsc_buy` or any other existing function.

Where it goes: one new migration in `sirsc104-debug/warden-chat`, with the same conventions as the Downhill Death Run, SirSC economy and Wildcard Chess migrations (RLS on every table and no client grants, `SECURITY DEFINER` with `set search_path = public, pg_temp`, the `warden_private.game_session_valid()` session check refusing as `putt_not_signed_in`, errors as `raise exception '<code>' using errcode = 'P0001'`, helpers in `warden_private`). It reads `sirsc_owned` (game `putt`) to decide whether an avatar or ball is shown, so it goes after the Putt Club economy migration.

What to build (the checklist at the end of the contract is the definition of done):
1. `putt_online_rooms`, `putt_online_players`, `putt_online_shots` and `putt_online_scores`, readable only by the room's players through the functions.
2. The seven functions: `putt_online_create`, `putt_online_join`, `putt_online_start`, `putt_online_state`, `putt_online_shot`, `putt_online_hole`, `putt_online_leave` (and the state shape they return), with the 30-minute expiry of waiting rooms, the 2-hour idle finish, and the 3-room limit.
3. Server-side dealing exactly as in "Dealing the holes": distinct hole ids from the room's course, in random order.
4. Shots are idempotent per `(seat, hole, stroke)`; the first hole score per `(seat, hole)` is kept; the room finishes when everyone still in it has scored the last hole.
5. Tests like the DDR and Wildcard Chess ones (native PostgreSQL, no Docker), with the existing tests still passing.

Before you finish: run the full test suite, check every name and JSON key against the contract, and report what you built, what the tests checked, and anything you had to interpret. Push the branch, but don't deploy to the live Warden Chat project until SirSC says so.

===== ONLINE-PUTT.md (the contract) =====

# Putt Club online: the back-end contract

Two to four signed-in Warden Chat players play the same round of Putt Club at the same time, each on
their own device. One player makes a room on a course and gets a 5-letter code; friends type the code
to join; the host tees off. This file is everything the back end has to provide; the front end
(`projects/putt-club/js/online.js` in `sirsc104-debug/wardenchat`) is built against it, together with
a pretend back end that follows it (`js/wallet-mock.js`, demo builds only).

Conventions as in the SirSC economy and Wildcard Chess's `docs/ONLINE-WCC.md`: one new migration in
`sirsc104-debug/warden-chat`; RLS on, no table grants to `anon`/`authenticated`; `SECURITY DEFINER`
functions with `set search_path = public, pg_temp`; the session check
`warden_private.game_session_valid()` (refuse as `putt_not_signed_in`); errors raised as
`raise exception '<code>' using errcode = 'P0001'`; grants to `authenticated` only.

## How it works, and what the server trusts

- **The server deals.** When the host tees off, the server picks the round's holes at random from the
  room's course, so nobody chooses easy ones. Every player's game plays them in that order.
- **Everyone plays their own ball.** Mini golf has no turns: each player putts on their own copy of the
  hole, and the others show up as ghost balls (as the rivals do offline).
- **Putts are relayed, not checked.** Each putt is sent once the ball has stopped (or dropped, or been
  lost) with where it was hit from, the physics step it was hit on, its angle, strength and where it
  ended. Every other player's game replays it in its own copy of the hole. The server only stores and
  orders them; it doesn't know golf.
- **Scores are reported by each player** when they hole out (or pick up). The server keeps the scorecard
  for everyone to read.
- **No coins** are paid for online rounds for now (friends could trade wins). The front end says so.
- Clients poll `putt_online_state` about every 1.2 seconds; nothing else is needed (no Realtime).

## Tables

```sql
create table public.putt_online_rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                 -- 5 letters from ABCDEFGHJKLMNPQRSTUVWXYZ
  host_id     uuid not null references auth.users(id) on delete cascade,
  diff        text not null check (diff in ('owen','medium','hard','ultra')),
  holes       integer not null check (holes in (9, 18)),
  hole_ids    text[],                               -- dealt when the host tees off
  status      text not null default 'waiting' check (status in ('waiting','playing','finished','cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table public.putt_online_players (
  room_id   uuid not null references public.putt_online_rooms(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  seat      integer not null check (seat between 0 and 3),   -- the host is seat 0
  avatar    text not null default 'golfer',
  ball      text not null default 'classic',
  left_at   timestamptz,                            -- set by putt_online_leave
  seen_at   timestamptz not null default now(),     -- last putt_online_state call
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);
create table public.putt_online_shots (
  seq      bigint generated always as identity primary key,  -- the order shots arrived in
  room_id  uuid not null references public.putt_online_rooms(id) on delete cascade,
  seat     integer not null,
  hole     integer not null,                        -- 0-based index into hole_ids
  stroke   integer not null,                        -- 1 for the first putt on the hole (penalties count)
  shot     jsonb not null,                          -- { step, angle, power, x, y, ex, ey, result }
  created_at timestamptz not null default now(),
  unique (room_id, seat, hole, stroke)
);
create table public.putt_online_scores (
  room_id  uuid not null references public.putt_online_rooms(id) on delete cascade,
  seat     integer not null,
  hole     integer not null,
  strokes  integer not null check (strokes between 1 and 20),
  primary key (room_id, seat, hole)
);
```

A `waiting` room more than 30 minutes old counts as `cancelled`. A `playing` room with no shot, score
or state call for 2 hours counts as `finished`. A player is in at most 3 rooms that are `waiting` or
`playing` (and that they haven't left) → `putt_too_many_games`.

## Dealing the holes

On `putt_online_start` the server picks `holes` distinct ids at random (uniformly, in random order)
from the room's course and stores them in `hole_ids`:

- `owen` → the Garden (27): pinwheel, sprinkler, lilypad, moles, gnomes, pumpkins, mushroom,
  wheelbarrow, maze, rockery, sunflower, brook, koi, tire, snail, honey, gust, carrots, daisy, pot,
  seesaw, beanstalk, tulips, greenhouse, trellis, falls, dandelion
- `medium` → the Canyon (27): saguaro-gate, prickly-slalom, tumbleweed-alley, barrel-ring,
  cholla-corner, mesa-top, dry-wash, sand-trap-flats, dust-devil, rattlesnake-slot, saloon-doors,
  mine-shaft, gulch-bridge, rock-arch, cactus-garden, hoodoo-pinball, dune-ridge, wagon-wheel,
  coyote-bowl, plank-seesaw, switchback-trail, tumble-twins, box-canyon, oasis, ghost-town, canyon-rim,
  sunset-mesa
- `hard` → the Winter Wonderland (27): candy-cane-lane, penguin-parade, thin-ice-crossing,
  gingerbread-village, snowball-slope, gumdrop-pinball, peppermint-twist, frozen-pond, ice-floe-ferry,
  ski-jump, blizzard-pass, snowman-alley, ornament-swing, toboggan-run, ice-rink, sleigh-ride,
  cracking-shortcut, avalanche, candy-cane-gates, present-hop, penguin-slide, frosty-maze, snow-globe,
  snowdrift-dunes, lift-line, hockey-rink, gingerbread-summit
- `ultra` → the Abyss (18): gates-of-dis, reapers-mill, imp-patrol, magma-pinball, geyser-leap,
  raft-of-charon, portal-maze, doom-pendulum, rune-wheel, obsidian-slide, tar-pits, ash-river,
  volcano-summit, the-crater, bone-bridge, soul-cart, sulfur-winds, the-descent

(18 holes on the Abyss uses all 18.) If the game ever adds holes, this list is updated with it.

## Avatars and balls

`putt_online_create` and `putt_online_join` take the avatar and ball the player has equipped (`avatar`
like `fox`, `ball` like `gold`). The server stores each one for that player in this room only if the
player owns it (`sirsc_owned` has `game = 'putt'` and `item_id = 'avatar:' || avatar` or
`'ball:' || ball`); otherwise, and for `golfer` / `classic` or null, it stores the default. Never an
error.

## The state

Every function except `putt_online_shot` returns the **state** of the room, from the caller's side:

```jsonc
{ "room_id": "uuid", "code": "KQBRT", "status": "playing",     // waiting | playing | finished | cancelled
  "diff": "hard", "holes": 9,
  "host": 0, "you": 2,                                          // seats: the host's and the caller's
  "hole_ids": ["frozen-pond", "ski-jump", ...],                 // null while waiting
  "players": [ { "seat": 0, "username": "sirsc", "member": true, "avatar": "dragon", "ball": "gold",
                 "left": false, "seen": 1 } ],                  // seen: whole seconds since their last state call
  "shots": [ { "seq": 41, "seat": 0, "hole": 2, "stroke": 3, "step": 2210, "angle": 1.5708,
               "power": 0.42, "x": 1.2, "y": 3.4, "ex": 0.1, "ey": 7.9, "result": "sunk" } ],
  "scores": [ { "seat": 0, "hole": 0, "strokes": 3 } ],         // every reported hole score
  "server_now": "2026-11-15T18:00:00Z" }
```

`players` lists everyone who has joined, in seat order, including players who left (`left: true`).
`shots` holds the shots with `seq > since` (all of them where there's no `since`), oldest first, the
fields of `shot` spread into each object alongside `seq`, `seat`, `hole` and `stroke`.

## Functions

### `putt_online_create(diff text, holes integer, avatar text default null, ball text default null) returns json`
Makes a `waiting` room with a fresh code; the caller is the host at seat 0. Errors: `putt_bad_setup`
(`diff` not one of the four, `holes` not 9 or 18), `putt_too_many_games`.

### `putt_online_join(code text, avatar text default null, ball text default null) returns json`
Joins a `waiting` room by code (case-insensitive) at the lowest free seat. Joining a room you're
already in (and haven't left) just returns its state. Errors: `putt_no_such_game` (unknown, cancelled
or expired), `putt_game_started` (not `waiting`), `putt_game_full` (4 players who haven't left),
`putt_too_many_games`.

### `putt_online_start(room_id uuid) returns json`
The host tees off: needs at least 2 players who haven't left (else `putt_need_players`), the caller is
the host (else `putt_not_host`), the room is `waiting` (else `putt_game_started`). Deals `hole_ids`,
sets `playing`.

### `putt_online_state(room_id uuid, since bigint default 0) returns json`
The state with shots `seq > since`. Records the caller's `seen_at`. Not a player of that room →
`putt_no_such_game`. Also where expiry (30 min waiting, 2 h idle) is applied.

### `putt_online_shot(room_id uuid, hole integer, stroke integer, step integer, angle double precision, power double precision, x double precision, y double precision, ex double precision, ey double precision, result text) returns json`
Stores one of the caller's putts. Checks: the room is `playing` (else `putt_game_over`); `hole` from 0
to `holes − 1`, `stroke` from 1 to 20, `step` from 0 to 2,000,000, `power` from 0 to 1, all numbers
finite and `abs()` at most 1,000, `result` one of `rest`, `sunk`, `lost` (else `putt_bad_shot`). A
second shot with the same `(seat, hole, stroke)` changes nothing (the client may resend after a network
error). Returns `{ "ok": true }`, not the state (it's sent after every putt; the next poll brings
everything). At most 60 shots a minute per player → `putt_bad_shot`.

### `putt_online_hole(room_id uuid, hole integer, strokes integer) returns json`
The caller's score for a hole once they've holed out or picked up. Checks: `playing` (else
`putt_game_over`), `hole` in range and `strokes` from 1 to 20 (else `putt_bad_shot`). The first report
for `(seat, hole)` is kept; later ones change nothing. When every player who hasn't left has a score for
the last hole, the room becomes `finished`. Returns the state (all shots).

### `putt_online_leave(room_id uuid) returns json`
Sets the caller's `left_at`. If the host leaves a `waiting` room, it is `cancelled`. If every player has
left a `playing` room, it is `finished`. Leaving twice changes nothing. Returns the state.

Error codes the front end knows: `putt_not_signed_in`, `putt_no_such_game`, `putt_game_full`,
`putt_game_started`, `putt_too_many_games`, `putt_need_players`, `putt_not_host`, `putt_bad_setup`,
`putt_bad_shot`, `putt_game_over`.

## Checklist

1. The four tables (RLS on, no grants), the seven functions above with exact names, parameters, JSON
   keys and error codes; only the room's players can read it; avatars and balls stored only when owned.
2. Dealing follows "Dealing the holes" exactly (distinct ids from the room's course).
3. Tests: create/join (case-insensitive code, rejoin, full, started, expired), the 3-room limit, start
   (host only, 2+ players), shots in order with `since`, duplicate shots ignored, bad shots refused,
   hole scores (first report kept) and the room finishing after the last hole, leaving (host cancels a
   waiting room; everyone gone finishes a playing one), and that a fifth account can't see or touch
   the room.
4. Deploy to the Warden Chat project once SirSC says so.

===== end of the contract =====
