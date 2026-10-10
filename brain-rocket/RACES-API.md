# Brain Rocket live races: the back-end contract

Play With Friends becomes a **live race**. A signed-in player hosts a race and gets a 6-character
room code. Friends join by code or by invite, and the host starts the race. Everyone counts down
together, gets the same questions, and watches each other's drills on a live board. The results
show a podium and a vote: if everyone still there votes to play again, the next round starts for
all of them at once, with new questions.

The front end is finished (`js/race.js`). This file is everything the back end has to provide. It
builds on [ACCOUNTS-API.md](ACCOUNTS-API.md) and follows the same rules: one new migration in the
`warden-chat` repo, RLS on, no table grants, `SECURITY DEFINER` functions with
`set search_path = public, pg_temp`, and the same session check as the `br_*` account functions
(Codex's `warden_private.br_assert_session()`). Errors are raised as
`raise exception '<code>' using errcode = 'P0001';`.

**Races need an account.** Guests see a "sign in to race" card instead. The old 8-character
challenge codes are gone from the game; nothing on the server ever used them.

**There is no websocket.** Each racer's browser calls `br_race_progress` or `br_race_state` about
every 1.5 seconds. That's enough for a live board in a 30 to 120-second race, with at most 8
racers. Supabase Realtime could replace it later without changing these functions.

## How a race goes

1. **Host:** `br_race_create(mode, len)` makes a race in the `lobby` state, with a fresh code and a
   random question seed. The host is its first player.
2. **Others join:** mostly by invite. The host picks friends when creating the race (the browser
   calls `br_race_invite(race_id, friend_id)` for each, straight after `br_race_create`) or invites
   more from the lobby. An invited friend sees the invite through `br_race_invites()` and joins with
   the code in it. Anyone signed in can also join with the code itself (`br_race_join(code)`).
3. **Lobby:** every player polls `br_race_state(race_id)` and sees who is in.
4. **Start:** the host calls `br_race_start(race_id)`. The server sets `starts_at` = now + 6 s and
   `ends_at` = `starts_at` + `len` s. Every browser lines its countdown up to `starts_at`, using
   `server_now` to correct for its own clock.
5. **Racing:** each browser sends its score with `br_race_progress` and reads everyone else's
   from the reply.
6. **Done:** each browser calls `br_race_finish` when its time runs out, or straight away if the
   player crashes. The race is `finished` once every player still in it has finished, or 20 s
   after `ends_at`, whichever comes first.
7. **Play again:** on the results, each racer votes with `br_race_vote(race_id, again)`. Voting no
   (or leaving) takes you out of the race. As soon as every racer still in it has voted yes, and
   there are at least 2 of them, the server starts the next **round** of the same race: a new seed
   (new questions), scores and votes reset, `starts_at` = now + 6 s. Everyone's browser sees the
   round number go up and counts down together, without going back to a lobby.

## Tables

All `user_id`s reference `auth.users(id) on delete cascade`.

```sql
create table public.br_races (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,            -- 6 chars from 23456789ABCDEFGHJKMNPQRSTVWXYZ
  host_id      uuid not null references auth.users(id) on delete cascade,
  mode         text not null check (mode in ('easy','medium','hard')),
  len          integer not null check (len in (30,60,120)),
  seed         integer not null check (seed >= 0),    -- 0 .. 2^31-1, chosen by the server
  status       text not null default 'lobby' check (status in ('lobby','racing','finished','closed')),
  created_at   timestamptz not null default now(),
  round        integer not null default 1, -- goes up each time everyone votes to play again
  starts_at    timestamptz,
  ends_at      timestamptz
);
-- a code is only unique among races that are still open
create unique index on public.br_races (code) where status in ('lobby','racing');

create table public.br_race_players (
  race_id     uuid not null references public.br_races(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  score       integer not null default 0,
  correct     integer not null default 0,
  finished    boolean not null default false,
  crashed     boolean not null default false,
  left_race   boolean not null default false,     -- left after the start (counts as did-not-finish)
  vote_again  boolean,                            -- null = hasn't voted this round; true = play again
  updated_at  timestamptz not null default now(),
  primary key (race_id, user_id)
);

create table public.br_race_invites (
  race_id    uuid not null references public.br_races(id) on delete cascade,
  from_id    uuid not null references auth.users(id) on delete cascade,
  to_id      uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (race_id, to_id)
);
```

## The race state (what most functions return)

```jsonc
{
  "race_id": "uuid",
  "code": "K7QM2X",
  "host_id": "uuid",
  "mode": "medium",                // easy | medium | hard
  "len": 60,                       // seconds of drilling: 30 | 60 | 120
  "seed": 1234567890,              // the same questions for everyone; new every round
  "round": 1,
  "status": "lobby",               // lobby | racing | finished | closed
  "starts_at": null,               // ISO time once started
  "ends_at": null,
  "server_now": "2026-10-10T18:04:05.123Z",   // always present, to sync clocks
  "players": [{                    // ordered by joined_at
    "user_id": "uuid", "username": "Sam_W", "is_host": true,
    "score": 0, "correct": 0, "finished": false, "crashed": false, "left": false,
    "voted": false                 // voted to play again this round
  }],
  "invited": [{ "user_id": "uuid", "username": "luna" }]   // invites still waiting, lobby only
}
```

`status` is worked out when the state is read: a `racing` race whose players have all finished or
left, or whose `ends_at` passed more than 20 s ago, is `finished` (and stored as such). `username`
comes from `public.profiles`.

## Functions

Grant `execute` to `authenticated` only. Every function checks the session first
(`br_not_signed_in`). Only players in a race can see its state; to anyone else it's
`br_race_not_found`.

### `br_race_create(mode text, len integer) returns json`
Creates a lobby with a new unique code and a random seed, with the caller as host and only
player. Returns the state.
- `mode` or `len` not allowed → `br_bad_race`.
- If the caller is in another lobby or race, they leave it first (as `br_race_leave` would).
- More than 20 races created by the caller in the last hour → `br_rate_limited`.

### `br_race_join(code text) returns json`
Joins the open race with that code (`upper(btrim(code))`) and returns the state.
- No race with that code → `br_race_not_found`
- It has started → `br_race_started`
- It's finished or closed → `br_race_closed`
- 8 players already → `br_race_full`
- Already in it → just return the state
- The caller leaves any other lobby or race first; joining deletes the caller's invite to it.

### `br_race_state(race_id uuid) returns json`
The state. The lobby and results screens call this about every 1.5 s.

### `br_race_invite(race_id uuid, friend_id uuid) returns void`
The caller (a player in that race, still in `lobby`) invites a friend.
- Not friends (see `br_friendships`) → `br_not_friends`
- Race not in lobby → `br_race_started`
- Friend already in the race → no error, nothing to do
- Already invited → no error
- More than 60 invites by the caller in the last hour → `br_rate_limited`

### `br_race_invites() returns json`
Invites waiting for the caller, for races still in `lobby` with room:
`[{ "race_id", "code", "from_username", "mode", "len", "players": <count>, "created_at" }]`,
newest first.

### `br_race_decline(race_id uuid) returns void`
Deletes the caller's invite to that race. No error if there isn't one.

### `br_race_leave(race_id uuid) returns void`
- In `lobby`: removes the caller. If they were host, the earliest-joined remaining player
  becomes host; if nobody is left, the race becomes `closed`.
- In `racing`: sets the caller's `left_race` (they show as "left" and can't win).
- Finished, closed, or not in it: no error.

### `br_race_start(race_id uuid) returns json`
- Not the host → `br_not_host`
- Not in `lobby` → `br_race_started`
- Fewer than 2 players → `br_need_players`
- Otherwise: `status = 'racing'`, `starts_at = now() + 6 s`, `ends_at = starts_at + len s`, pending
  invites deleted. Returns the state.

### `br_race_progress(race_id uuid, score integer, correct integer) returns json`
A racer's live score. Only while `racing`, from `starts_at - 5 s` to `ends_at + 20 s`, and only
for a player who hasn't finished or left (otherwise it changes nothing and just returns the state).
- Clamp `score` to 0 .. 10,000,000 and `correct` to 0 .. 1,000. Set `updated_at`.
- Returns the state.

### `br_race_finish(race_id uuid, score integer, correct integer, crashed boolean) returns json`
Final result. Same window and clamps as `br_race_progress`. If `crashed`, store `score = 0`.
Sets `finished = true`. Calling it again changes nothing. Returns the state.

### `br_race_vote(race_id uuid, again boolean) returns json`
For a player of a `finished` race (`br_race_started` while it's still racing, `br_race_not_found`
if they aren't in it).
- `again = false`: the same as `br_race_leave` (the player is out of the race and its next rounds).
- `again = true`: sets the caller's `vote_again`. Then, if every player who hasn't left has voted
  yes and there are at least 2 of them, start the next round in the same transaction:
  `round = round + 1`, a new random `seed`, `status = 'racing'`, `starts_at = now() + 6 s`,
  `ends_at = starts_at + len s`, and for every remaining player `score = 0`, `correct = 0`,
  `finished = false`, `crashed = false`, `vote_again = null`. Players who left stay left.
- If only the caller is left (everyone else left), raise `br_need_players`.
- Returns the state (already the new round when this vote completed it).

## Housekeeping

- Lobbies untouched for 30 minutes and races older than 2 hours can be set to `closed` (lazily
  when read, or by a scheduled job), and closed races deleted after a day.
- The friend checks reuse `br_friendships` from the accounts migration.

## Checklist

1. Migration: three tables, RLS on, no table grants, cascade to `auth.users`.
2. The eleven functions above with the exact names, parameters, JSON shapes and error codes.
3. Concurrency: join, start, vote and leave must lock the race row (`select … for update`) so two
   racers can't both take the 8th place, a start can't race a leave, and two last votes can't both
   start a round.
4. `verify.mjs` checks: an outsider can't read a race's state, can't send progress for someone
   else, can't start a race they don't host, and can only invite friends.
