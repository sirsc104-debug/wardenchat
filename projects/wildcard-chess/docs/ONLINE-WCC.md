# Wildcard Chess online: the back-end contract

Two signed-in Warden Chat players play one game of Wildcard Chess from two devices. One creates a
game and gets a 5-letter code, the other types the code to join. This file is everything the back end
has to provide; the front end (`projects/wildcard-chess/js/online.js` in `sirsc104-debug/wardenchat`)
is built against it, together with a pretend back end that follows it (`js/wallet-mock.js`, demo
builds only).

Conventions as in Downhill Death Run's `docs/ONLINE-API.md` and the SirSC economy: one new migration in
`sirsc104-debug/warden-chat`; RLS on, no table grants to `anon`/`authenticated`; `SECURITY DEFINER`
functions with `set search_path = public, pg_temp`; the session check
`warden_private.game_session_valid()` (refuse as `wcc_not_signed_in`); errors raised as
`raise exception '<code>' using errcode = 'P0001'`; grants to `authenticated` only.

## How it works, and what the server trusts

- **The server deals.** It picks both sides' wildcards and the squares they replace when the game is
  created, so neither player can choose their own hand. Both clients build the same starting position
  from that `setup`.
- **The server keeps order, the clients keep the rules.** The server stores the moves in order and
  checks that the player sending a move is the one whose turn it is and that they are in sync. It does
  not know chess. Each client checks every move it receives against its own copy of the rules engine,
  and stops the game if a move doesn't fit ("disputed").
- **Whose turn is next is told by the client.** Wildcard Chess has extra turns (the Chronomancer, the
  Time Lord), so the client that moves sends `next_turn` and the server stores it.
- **No coins** are paid for online games for now (two friends could trade wins). The front end says so.
- Clients poll `wcc_online_state` about every 1.5 seconds; nothing else is needed (no Realtime).

## Tables

```sql
create table public.wcc_online_games (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                 -- 5 letters from ABCDEFGHJKLMNPQRSTUVWXYZ
  white_id    uuid references auth.users(id) on delete cascade,
  black_id    uuid references auth.users(id) on delete cascade,
  host_id     uuid not null references auth.users(id) on delete cascade,
  setup       jsonb not null,                       -- see "The setup"
  status      text not null default 'waiting' check (status in ('waiting','playing','finished','cancelled')),
  turn        text not null default 'w' check (turn in ('w','b')),
  result      jsonb,                                -- { "winner": "w"|"b"|null, "reason": "..." }
  white_seen  timestamptz, black_seen timestamptz,  -- last wcc_online_state call by each player
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table public.wcc_online_moves (
  game_id  uuid not null references public.wcc_online_games(id) on delete cascade,
  ply      integer not null check (ply >= 0),       -- 0 for the first move
  by_color text not null check (by_color in ('w','b')),
  move     jsonb not null,                          -- the client's move object, at most 1 KB
  created_at timestamptz not null default now(),
  primary key (game_id, ply)
);
```

A `waiting` game more than 30 minutes old counts as `cancelled`. A player has at most 3 games that are
`waiting` or `playing` → `wcc_too_many_games`.

## The setup

```jsonc
{ "wild": { "w": ["bomber"], "b": ["void"] },        // wildcard ids, all distinct across both sides
  "slots": { "w": [11], "b": [51] },                  // the square each wildcard replaces, same order
  "fog": false }
```

- `wildcards` (1 to 3) per side. Each wildcard is, independently, **legendary with probability 0.05**
  (one of: dragon, archangel, timelord, blackhole, zeus) and otherwise one of the 50 common ids:
  bomber, phantom, blink, trickster, archer, necro, frost, wyvern, hopper, serpent, ricochet, orbit,
  juggernaut, cannon, tempest, mimic, siren, guardian, golem, phoenix, viper, brood, chrono, mason,
  vampire, marauder, hexer, catapult, assassin, void, magnet, rampage, comet, kangaroo, tesla, drummer,
  sniper, amoeba, changeling, monk, alchemist, displacer, oracle, zombie, chameleon, warlord, cyclops,
  gorgon, grappler, echo.
- `slots`: for White, distinct random squares from 0–15 except 4 (the king); for Black, from 48–63
  except 60. Squares are numbered rank × 8 + file, a1 = 0, h8 = 63.
- The host's colour is random.

## Avatars

`wcc_online_create` and `wcc_online_join` take the avatar the player has equipped (`avatar`, an id
like `dragon`). The server stores it for that player in this game only if the player owns it
(`sirsc_owned` has `game = 'wcc'`, `item_id = 'avatar:' || avatar`); otherwise, and for `king` or
null, it stores `king`. Each player object in the state carries `"avatar"`, so both players see each
other's. Add the column `white_avatar text not null default 'king'` and `black_avatar` to
`wcc_online_games`. Never an error.

## Functions

Every function returning a game returns the **state** below for that game, from the caller's side.

```jsonc
{ "game_id": "uuid", "code": "KQBRT", "color": "w",            // the caller's colour
  "status": "playing", "turn": "b", "ply": 7,                    // ply: moves made so far
  "setup": { ... },
  "white": { "username": "sirsc", "member": true, "avatar": "dragon" }, "black": { "username": "pal", "member": false, "avatar": "king" },   // null while waiting
  "moves": [ { "ply": 6, "by": "w", "move": { ... } } ],        // moves with ply >= since (all for create/join)
  "result": null,                                                // or { "winner": "b", "reason": "resign" }
  "opponent_seen": 2 }                                           // seconds since the opponent's last state call; null while waiting
```

### `wcc_online_create(wildcards integer, fog boolean, avatar text default null) returns json`
Makes a `waiting` game with a fresh code and setup; the caller is the host, at a random colour. Errors:
`wcc_bad_setup` (wildcards not 1–3), `wcc_too_many_games`.

### `wcc_online_join(code text, avatar text default null) returns json`
Joins a `waiting` game by code (case-insensitive) as the other colour; status becomes `playing`.
Errors: `wcc_no_such_game` (unknown, cancelled or expired), `wcc_game_full`, `wcc_own_game` (the host).

### `wcc_online_state(game_id uuid, since integer) returns json`
The state with moves `ply >= since`. Records the caller's `*_seen`. Not a player of that game →
`wcc_no_such_game`.

### `wcc_online_move(game_id uuid, ply integer, move jsonb, next_turn text) returns json`
Appends a move. Checks, in one transaction with the game row locked: status `playing` (else
`wcc_game_over`), the caller's colour is `turn` (else `wcc_not_your_turn`), `ply` equals the number of
moves so far (else `wcc_out_of_sync`), `move` is a JSON object of at most 1 KB and `next_turn` is `w`
or `b` (else `wcc_bad_move`). Then stores it, sets `turn = next_turn`. Returns the state (since `ply`).

### `wcc_online_finish(game_id uuid, winner text, reason text) returns json`
A client's engine says the game is over: `winner` `w`, `b` or `draw`; `reason` one of `mate`, `king`,
`stalemate`, `fifty`, `repetition`, `material`, `disputed` (else `wcc_bad_result`). The first report
finishes the game (`result = { winner: null for draw, reason }`); a later matching report changes
nothing; a later different one changes the result to `{ "winner": null, "reason": "disputed" }`.

### `wcc_online_resign(game_id uuid) returns json`
While `playing`: finished, the other colour wins, reason `resign`.

### `wcc_online_cancel(game_id uuid) returns json`
The host cancels a `waiting` game. Else `wcc_game_over`.

### `wcc_online_claim(game_id uuid) returns json`
While `playing`, if the opponent hasn't called `wcc_online_state` for more than 120 seconds: the caller
wins, reason `timeout`. Otherwise `wcc_opponent_here`.

## Checklist

1. The two tables (RLS on, no grants), the nine functions above with exact names, parameters, JSON keys
   and error codes; only the two players can read a game; avatars stored only when owned.
2. Setups follow "The setup" exactly (distinct ids, 5% legendary, slots never the king's square).
3. Tests: create/join/expire/cancel, the 3-game limit, turn order with `next_turn` (including two moves
   in a row by the same colour), out-of-sync and game-over errors, finish agreement and disputes,
   resign, claim after 120 s and not before, and that a third account can't see or touch the game.
4. Deploy to the Warden Chat project once SirSC says so.
