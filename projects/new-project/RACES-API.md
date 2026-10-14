# Fruit Dash live races: the back-end contract

**Fruit Dash** is Apples to Oranges' race mode (it took Real Size's place on the menu). It's 60
seconds of Classic higher or lower; highest score wins. A signed-in player hosts a race and gets a
6-character code. Friends join by code or invite, **each as a different fruit** (apple, orange,
banana, strawberry, watermelon, pineapple, grapes or lemon), and the host starts it. Everyone counts
down together and gets the same matchups in the same order, while their fruits dash across a
kitchen on everyone's screen. The results show a podium and a vote: if everyone still there votes to
play again, the next round starts for all of them at once, with new matchups.

The front end is finished (`js/race.js`, with `js/game.js` and `js/kitchen.js`). This file is
everything the back end has to provide. It builds on [ACCOUNTS-API.md](ACCOUNTS-API.md) and follows
the same rules: one new migration in the `warden-chat` repo (it can be the same one as the
accounts), RLS on, no table grants, `SECURITY DEFINER` functions with
`set search_path = public, pg_temp`, and the same session check as the `a2o_*` account functions.
Errors are raised as `raise exception '<code>' using errcode = 'P0001';`.

It is Brain Rocket's `RACES-API.md` (built as `20261010160012_brain_rocket_races.sql`) with four
changes, so that migration is the best starting point:

1. The `a2o_` prefix, and `diff` (`owen | medium | hard | ultra`) instead of `mode`.
2. **No `len` choice**: every race is 60 seconds.
3. **Fruits**: every player has a `fruit` (0–7), unique among the players still in the race.
   There's one new function, `a2o_race_fruit`.
4. **No crashing** (a dash can't crash), so no `crashed` column or parameter.

**Races need an account.** Guests (and everyone, until this is deployed) can still play a solo
practice dash; that never touches the server.

**There is no websocket.** Each racer's browser calls `a2o_race_progress` or `a2o_race_state` about
every 1.5 seconds. That's enough for a live board in a 60-second race with at most 8 racers.

## How a race goes

1. **Host:** `a2o_race_create(diff)` makes a race in the `lobby` state, with a fresh code and a
   random matchup seed. The host is its first player, with fruit 0 (the apple).
2. **Others join:** mostly by invite. The host picks friends when creating the race (the browser
   calls `a2o_race_invite(race_id, friend_id)` for each, straight after `a2o_race_create`) or invites
   more from the lobby. An invited friend sees the invite through `a2o_race_invites()` and joins with
   the code in it. Anyone signed in can also join with the code (`a2o_race_join(code)`). Joining
   gives you the **lowest-numbered fruit nobody else in the race has**.
3. **Lobby:** every player polls `a2o_race_state(race_id)` and sees who is in, as which fruit. A
   player can switch to any free fruit with `a2o_race_fruit(race_id, fruit)` (the browser asks for
   the player's favourite fruit right after joining, if it's free).
4. **Start:** the host calls `a2o_race_start(race_id)`. The server sets `starts_at` = now + 6 s and
   `ends_at` = `starts_at` + 60 s. Every browser lines its 3-2-1 countdown up to `starts_at`, using
   `server_now` to correct for its own clock, and stops answering at `ends_at`.
5. **Racing:** each browser sends its score with `a2o_race_progress` and reads everyone else's
   from the reply (the other fruits run along the kitchen at their scores).
6. **Done:** each browser calls `a2o_race_finish` when its clock runs out. The race is `finished`
   once every player still in it has finished, or 15 s after `ends_at`, whichever comes first.
   Players who never called `a2o_race_finish` keep their last progress score.
7. **Play again:** on the results, each racer votes with `a2o_race_vote(race_id, again)`. Voting no
   (or leaving) takes you out of the race. As soon as every racer still in it has voted yes, and
   there are at least 2 of them, the server starts the next **round** of the same race: a new seed
   (new matchups), scores and votes reset, fruits kept, `starts_at` = now + 6 s. Everyone's browser
   sees the round number go up and counts down together, without going back to a lobby.

## The seed

`seed` is an integer from 0 to 2^31 − 1, chosen by the server (new every round). The browser feeds
it to a seeded random number generator (`Pairs.useSeed(seed)` in `js/pairs.js`), so every racer
gets the same matchups in the same order. The server never needs to know the matchups.

## Tables

All `user_id`s reference `auth.users(id) on delete cascade`.

```sql
create table public.a2o_races (
  id           uuid primary key default gen_random_uuid(),
  code         text not null check (code ~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$'),
  host_id      uuid not null references auth.users(id) on delete cascade,
  diff         text not null check (diff in ('owen','medium','hard','ultra')),
  seed         integer not null check (seed >= 0),
  status       text not null default 'lobby' check (status in ('lobby','racing','finished','closed')),
  round        integer not null default 1 check (round > 0),
  created_at   timestamptz not null default now(),
  starts_at    timestamptz,
  ends_at      timestamptz,
  updated_at   timestamptz not null default now(),
  closed_at    timestamptz
);
-- a code is only unique among races that are still open
create unique index on public.a2o_races (code) where status in ('lobby','racing');

create table public.a2o_race_players (
  race_id     uuid not null references public.a2o_races(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  fruit       smallint not null check (fruit between 0 and 7),
  score       integer not null default 0 check (score between 0 and 250000),
  correct     integer not null default 0 check (correct between 0 and 200),
  finished    boolean not null default false,
  left_race   boolean not null default false,     -- left after the start (counts as did-not-finish)
  vote_again  boolean,                            -- null = hasn't voted this round; true = play again
  updated_at  timestamptz not null default now(),
  primary key (race_id, user_id)
);
-- two players still in a race can't be the same fruit
create unique index on public.a2o_race_players (race_id, fruit) where not left_race;

create table public.a2o_race_invites (
  race_id    uuid not null references public.a2o_races(id) on delete cascade,
  from_id    uuid not null references auth.users(id) on delete cascade,
  to_id      uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (race_id, to_id)
);

-- one row per finished round, for friends' race wins (ACCOUNTS-API.md: a2o_friends.race_wins)
create table public.a2o_race_results (
  race_id    uuid not null references public.a2o_races(id) on delete cascade,
  round      integer not null,
  winner_id  uuid references auth.users(id) on delete cascade,   -- null for a tie at the top
  finishers  integer not null,
  diff       text not null,
  created_at timestamptz not null default now(),
  primary key (race_id, round)
);
```

`a2o_race_results` is written when a round becomes `finished` (in the same transaction): the player
with the highest score among those who didn't leave, if exactly one has it and there were 2 or more
of them. Races are deleted after a day (see Housekeeping), so give `a2o_race_results` its own
retention or keep `winner_id` rows even when the race is gone (drop the foreign key to
`a2o_races`, or copy what's needed): `race_wins` should keep counting.

## The race state (what most functions return)

```jsonc
{
  "race_id": "uuid",
  "code": "K7QM2X",
  "host_id": "uuid",
  "diff": "medium",                // owen | medium | hard | ultra
  "len": 60,                       // always 60 (seconds)
  "seed": 1234567890,              // the same matchups for everyone; new every round
  "round": 1,
  "status": "lobby",               // lobby | racing | finished | closed
  "starts_at": null,               // ISO time once started
  "ends_at": null,
  "server_now": "2026-10-14T18:04:05.123Z",   // always present, to sync clocks
  "players": [{                    // ordered by joined_at
    "user_id": "uuid", "username": "Sam_W", "is_host": true,
    "fruit": 0,                    // 0 apple, 1 orange, 2 banana, 3 strawberry, 4 watermelon, 5 pineapple, 6 grapes, 7 lemon
    "score": 0, "correct": 0, "finished": false, "left": false,
    "voted": false                 // voted to play again this round
  }],
  "invited": [{ "user_id": "uuid", "username": "luna" }]   // invites still waiting, lobby only
}
```

`status` is worked out when the state is read: a `racing` race whose players have all finished or
left, or whose `ends_at` passed more than 15 s ago, is `finished` (and stored as such, writing its
`a2o_race_results` row). `username` comes from `public.profiles`.

## Functions

Grant `execute` to `authenticated` only. Every function checks the session first
(`a2o_not_signed_in`, which also covers suspended and banned accounts). Only players in a race can
see its state; to anyone else it's `a2o_race_not_found`.

### `a2o_race_create(diff text) returns json`
Creates a lobby with a new unique code and a random seed, with the caller as host and only player
(fruit 0). Returns the state.
- `diff` not one of `owen`, `medium`, `hard`, `ultra` → `a2o_bad_race`.
- If the caller is in another lobby or race, they leave it first (as `a2o_race_leave` would).
- More than 20 races created by the caller in the last hour → `a2o_rate_limited`.

### `a2o_race_join(code text) returns json`
Joins the open race with that code (`upper(btrim(code))`), as the lowest free fruit, and returns
the state.
- No race with that code → `a2o_race_not_found`
- It has started → `a2o_race_started`
- It's finished or closed → `a2o_race_closed`
- 8 players already → `a2o_race_full`
- Already in it → just return the state
- The caller leaves any other lobby or race first; joining deletes the caller's invite to it.

### `a2o_race_fruit(race_id uuid, fruit integer) returns json`
The caller switches fruit, in the lobby only. Returns the state.
- Race not in `lobby` → `a2o_race_started`
- `fruit` not 0–7 → `a2o_bad_race`
- Another player still in the race has it → `a2o_fruit_taken`
- Already that fruit → just return the state

### `a2o_race_state(race_id uuid) returns json`
The state. The lobby and results screens call this about every 1.5 s.

### `a2o_race_invite(race_id uuid, friend_id uuid) returns void`
The caller (a player in that race, still in `lobby`) invites a friend.
- Not friends (Brain Rocket's `br_friendships`) → `a2o_not_friends`
- Race not in lobby → `a2o_race_started`
- Friend already in the race, or already invited → no error, nothing to do
- More than 60 invites by the caller in the last hour → `a2o_rate_limited`

### `a2o_race_invites() returns json`
Invites waiting for the caller, for races still in `lobby` with room:
`[{ "race_id", "code", "from_username", "diff", "players": <count>, "created_at" }]`, newest first.
The home screen calls this every 10 seconds.

### `a2o_race_decline(race_id uuid) returns void`
Deletes the caller's invite to that race. No error if there isn't one.

### `a2o_race_leave(race_id uuid) returns void`
- In `lobby`: removes the caller (freeing their fruit). If they were host, the earliest-joined
  remaining player becomes host; if nobody is left, the race becomes `closed`.
- In `racing` or `finished`: sets the caller's `left_race` (they show as "left", can't win, and
  are out of later rounds). In `finished`, this can complete a play-again vote (see
  `a2o_race_vote`).
- Closed, or not in it: no error.

### `a2o_race_start(race_id uuid) returns json`
- Not the host → `a2o_not_host`
- Not in `lobby` → `a2o_race_started`
- Fewer than 2 players → `a2o_need_players`
- Otherwise: `status = 'racing'`, `starts_at = now() + 6 s`, `ends_at = starts_at + 60 s`, pending
  invites deleted. Returns the state.

### `a2o_race_progress(race_id uuid, score integer, correct integer) returns json`
A racer's live score. Only while `racing`, from `starts_at` to `ends_at + 15 s`, and only for a
player who hasn't finished or left (otherwise it changes nothing and just returns the state).
- Clamp `score` to 0 .. 250,000 and `correct` to 0 .. 200. A dash's score never goes down (there are
  no penalties), so keep the higher of the stored and new values for both. Set `updated_at`.
- Returns the state.

### `a2o_race_finish(race_id uuid, score integer, correct integer) returns json`
Final result. Same window, clamps and never-goes-down rule as `a2o_race_progress`. Sets
`finished = true`. Calling it again changes nothing. Returns the state.

### `a2o_race_vote(race_id uuid, again boolean) returns json`
For a player of a `finished` race (`a2o_race_started` while it's still racing,
`a2o_race_not_found` if they aren't in it).
- `again = false`: the same as `a2o_race_leave`.
- `again = true`: sets the caller's `vote_again`. Then, if every player who hasn't left has voted
  yes and there are at least 2 of them, start the next round in the same transaction:
  `round = round + 1`, a new random `seed`, `status = 'racing'`, `starts_at = now() + 6 s`,
  `ends_at = starts_at + 60 s`, and for every remaining player `score = 0`, `correct = 0`,
  `finished = false`, `vote_again = null` (fruits stay). Players who left stay left.
- If only the caller is left (everyone else left), raise `a2o_need_players`.
- Returns the state (already the new round when this vote completed it).

## Trust

Scores come from the browsers, as in Brain Rocket: the server can't check the answers, because it
never sees the matchups. The clamps, the never-goes-down rule and the time window keep a broken or
meddling browser from doing anything worse than posting a big number in a race among friends. The
highest real 60-second score is far below 250,000 (Legendary 200 × Ultra 1.75 × speed 2 × streak 5
is 3,500 per answer, at well over a second per answer).

## Housekeeping

- Lobbies untouched for 30 minutes and races older than 2 hours can be set to `closed` (lazily when
  read, or by a scheduled job), and closed races deleted after a day.
- The friend checks reuse `br_friendships` from Brain Rocket's accounts migration.

## Checklist

1. Migration: the four tables, RLS on, no table grants, cascade to `auth.users`, the unique
   open-code index and the unique fruit-per-race index.
2. The twelve functions above (`a2o_race_create`, `_join`, `_fruit`, `_state`, `_invite`,
   `_invites`, `_decline`, `_leave`, `_start`, `_progress`, `_finish`, `_vote`, plus the winner
   bookkeeping behind `a2o_friends.race_wins`) with the exact names, parameters, JSON shapes and
   error codes.
3. Concurrency: join, fruit, start, vote and leave lock the race row (`select … for update`) so two
   racers can't both take the 8th place or the same fruit, a start can't race a leave, and two last
   votes can't both start a round.
4. `verify.mjs` checks: an outsider can't read a race's state, can't send progress for someone
   else, can't start a race they don't host, can only invite friends, and can't take a fruit
   someone else has.

To try the front end before this exists: `python3 build-artifact.py demo.html --standalone
--accounts-demo` builds the game with a pretend back end (`js/account-mock.js`) that follows this
contract, pretend racers included. Sign in as `demo` / `oranges12345`, open Fruit Dash, Host a race,
and use the DEMO bar's "Add a racer".
