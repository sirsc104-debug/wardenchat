# Apples to Oranges accounts: the back-end contract

Apples to Oranges' account screens are finished (`js/account.js`, `js/accountui.js`). This file is
everything the back end has to provide for them to work. It is written for whoever builds the back
end (Codex): build exactly this, and the front end needs no changes. It is Brain Rocket's
`ACCOUNTS-API.md` again with an `a2o_` prefix and a simpler progress document, and it reuses Brain
Rocket's friendships, so most of it can follow the Brain Rocket migration
(`20261010145850_brain_rocket_accounts.sql`) closely.

## The big picture

- **Accounts are Warden Chat accounts.** Apples to Oranges signs in against Warden Chat's Supabase
  project (`https://djmyvnaragfwoaljzexn.supabase.co`, the same URL and publishable key as
  `warden-chat/public/js/config.js` and Brain Rocket). Creating an account in Apples to Oranges
  creates a Warden Chat account, exactly as Warden Chat's own sign-up does
  (`<username>@warden.invalid` as the email, the username in `user_metadata.username`, so Warden
  Chat's `handle_new_user` trigger makes the profile).
- **There is no Apples to Oranges server.** The browser talks straight to Supabase: Supabase Auth
  for signing in, and the `a2o_*` Postgres functions below (called through PostgREST,
  `POST /rest/v1/rpc/<name>`) for best scores and friends. All the rules live in the database.
- **Friends are shared with Brain Rocket.** A friend in Brain Rocket is a friend here and the other
  way round: the `a2o_friend_*` functions use Brain Rocket's `br_friend_requests` and
  `br_friendships` tables (and its caps and rate limits). No new friendship tables.
- **Changing a password and deleting an account happen on Warden Chat only.** The game links there.
  Nothing here changes Supabase Auth settings or Warden Chat's existing tables.
- **Suspended and banned accounts.** Every `a2o_*` function except `a2o_ping` refuses a restricted
  account the same way it refuses no session: with `a2o_not_signed_in` (reuse
  `warden_private.game_session_valid()`, the way `br_assert_session()` does). The browser then calls
  Warden Chat's existing `my_account_state()` and shows a "you've been banned" screen. Nothing to
  build for that beyond the session check.
- The back end is one new migration in the `warden-chat` repo, e.g.
  `supabase/migrations/<timestamp>_apples_to_oranges.sql`, following that repo's conventions (RLS
  on, no direct table grants, `SECURITY DEFINER` functions with `set search_path = public, pg_temp`,
  every rule enforced in SQL). It needs Brain Rocket's accounts migration applied first.

## How the front end decides accounts are switched on

On every page load the game calls `a2o_ping` **without signing in** (publishable key in the `apikey`
header only). If it gets a 2xx, the Sign in button appears (top left of the home screen, next to the
sound buttons) and Fruit Dash's "Join a race / Host a race" panel switches on. Anything else (404
because the function doesn't exist yet, no network) hides accounts completely: the game works
exactly as before, saving on the device only, and Fruit Dash offers only practice. So the front end
ships before the back end; everything appears the moment the migration is applied.

## Supabase Auth calls the front end makes (nothing to build)

| What | Request |
| --- | --- |
| Sign in | `POST /auth/v1/token?grant_type=password` `{ email: "<lowercased username>@warden.invalid", password }` |
| Create account | `POST /auth/v1/signup` `{ email, password, data: { username } }`; expects a session back (email confirmation must stay **off**, as Warden Chat already needs) |
| Keep signed in | `POST /auth/v1/token?grant_type=refresh_token` `{ refresh_token }`, about 90 s before the access token expires |
| Sign out | `POST /auth/v1/logout?scope=local` (this device only, so Warden Chat and Brain Rocket stay signed in elsewhere) |
| Banned? | `POST /rest/v1/rpc/my_account_state` (Warden Chat's existing function) after an `a2o_*` call says `a2o_not_signed_in` |

The front end recognises these Auth errors: `invalid_credentials` (wrong username or password),
`user_already_exists` (username taken), `weak_password`, HTTP 429 (rate limited), and
"Database error saving new user" (the profile trigger refused the username).

## Tables

One new table. RLS enabled and **no grants to `anon` or `authenticated`**; every read and write
goes through the functions below. `user_id` references `auth.users(id) on delete cascade`, so
deleting a Warden Chat account removes its Apples to Oranges data too.

```sql
-- one row per player: their best scores, as one JSON document
create table public.a2o_progress (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  doc        jsonb not null check (jsonb_typeof(doc) = 'object' and octet_length(doc::text) <= 16384),
  rev        integer not null default 1 check (rev > 0),
  updated_at timestamptz not null default now()
);
```

Friend requests and friendships live in Brain Rocket's `br_friend_requests` and `br_friendships`.

## The progress document (`a2o_progress.doc`)

The front end owns this shape. It is the game's own save (`localStorage['a2o.best2']`): the best
score for every mode and difficulty.

```jsonc
{
  "schema": 1,
  "bests": {
    "classic": { "owen": 4210, "medium": 1980, "hard": 900, "ultra": 12450 },
    "race":    { "medium": 2140 },        // 🏃 Fruit Dash: best 60-second score (races and practice)
    "guess":   { "owen": 1400 },          // 🐿️ Guess the Number
    "haunt":   { "hard": 3020 },          // 🎃 Halloween
    "size":    { "owen": 800 }            // 🐉 Real Size (retired from the menu; old bests are kept)
  }
}
```

Mode and difficulty keys are short lowercase words (`^[a-z]{1,16}$`); scores are whole numbers from
1 to 1,000,000,000. The browser drops anything else before saving. The back end doesn't need to
understand the document beyond what `a2o_friends` reads from it.

**Merging is done by the browser, not the server.** The browser fetches the stored copy, merges it
with what's on the device (the higher score wins for every mode and difficulty), and saves the
result. The server only has to refuse a save that is based on an old `rev` (optimistic locking), so
two devices can't overwrite each other.

## Functions

All return JSON (or nothing). Errors the player should see are raised as
`raise exception '<code>' using errcode = 'P0001';` with exactly the codes listed. PostgREST turns
that into HTTP 400 `{ "code": "P0001", "message": "<code>" }`, and the front end shows the matching
message. Any other error shows "Something went wrong". **The front end treats a `br_…` code exactly
like the matching `a2o_…` code**, so the friend functions can simply call Brain Rocket's and let its
errors through.

Grant `execute` on `a2o_ping` to `anon, authenticated`; on everything else to `authenticated` only.
Revoke from `public`. Every function except `a2o_ping` starts with the session check (raising
`a2o_not_signed_in` for no session or a restricted account).

### `a2o_ping() returns boolean`
Returns `true`. Exists so the front end can tell that this migration is deployed.

### `a2o_get_progress() returns json`
The caller's progress: `{ "doc": <jsonb or null>, "rev": <int, 0 when no row> }`.

### `a2o_save_progress(doc jsonb, base_rev integer) returns json`
Saves the caller's merged progress, if nobody else has saved since the browser read `base_rev`.
- Reject unless `jsonb_typeof(doc) = 'object'` and `octet_length(doc::text) <= 16384` →
  `a2o_bad_progress`.
- No row yet and `base_rev = 0` → insert with `rev = 1`.
- Row exists and `rev = base_rev` → update `doc`, `rev = rev + 1`, `updated_at = now()`.
- Anything else (including the insert losing a race) → **don't raise**, return
  `{ "ok": false, "conflict": true, "rev": <current rev> }`. The browser re-reads, merges and tries
  again (up to 3 times).
- Success returns `{ "ok": true, "rev": <new rev> }`.

### `a2o_friends() returns json`
Everything the Friends screen, the results screen and the Fruit Dash panel need, for the caller:

```jsonc
{
  "friends": [{
    "user_id": "uuid", "username": "Sam_W",            // username from public.profiles
    "bests": { "classic": { "owen": 6120 }, "race": { "hard": 3610 } },   // their doc->'bests', or {}
    "race_wins": 3                                     // Fruit Dash races they won (see RACES-API.md)
  }],
  "incoming": [{ "request_id": "uuid", "username": "Owen.K", "created_at": "…" }],   // sent to the caller
  "outgoing": [{ "request_id": "uuid", "username": "mia-r",  "created_at": "…" }]    // sent by the caller
}
```
- `bests` is the friend's `a2o_progress.doc->'bests'` if it is an object, otherwise `{}` (no row
  yet: `{}`). The browser cleans it before showing it.
- `race_wins` counts the friend's won Fruit Dash rounds: rounds of races with 2 or more finishers
  where they had the top score (see `a2o_race_results` in RACES-API.md). 0 if none.
- Only accepted friends (`br_friendships`) appear in `friends`. **Nothing about non-friends is ever
  returned**, except usernames on requests that involve the caller.

### `a2o_friend_request(target_username text) returns json`
### `a2o_friend_respond(request_id uuid, accept boolean) returns void`
### `a2o_friend_cancel(request_id uuid) returns void`
### `a2o_friend_remove(friend_id uuid) returns void`
Exactly Brain Rocket's `br_friend_request`, `br_friend_respond`, `br_friend_cancel` and
`br_friend_remove`, on the same tables, with the same caps, rate limit, locking and results
(`{ "status": "sent" }` or `{ "status": "accepted" }` from a request). The simplest build is a
wrapper that calls the `br_` function. The codes the front end explains (as `a2o_…` or `br_…`):
`user_not_found`, `self`, `already_friends`, `already_requested`, `too_many`, `rate_limited`,
`request_not_found`.

## What players can and can't see

- Your progress document: only you (through `a2o_get_progress`).
- Your username, best scores and race wins: only people you have accepted as friends.
- Whether a username exists: anyone signed in can find out by sending a request (as in Brain Rocket
  and Warden Chat's "start new chat").
- Nobody can list or search users.

## Checklist for the back end

1. Migration with `a2o_progress`, RLS enabled, no table grants, `on delete cascade` to `auth.users`.
2. The eight functions above, `SECURITY DEFINER`, `set search_path = public, pg_temp`, the session
   check (restricted accounts refused as `a2o_not_signed_in`), the error codes as written, the
   grants as written.
3. `a2o_ping` callable with only the publishable key.
4. Friends through Brain Rocket's tables: a friendship made in either game shows in both.
5. Leave Supabase Auth settings alone (email confirmation off, as Warden Chat needs).
6. `scripts/verify.mjs` checks: anon can call `a2o_ping` but nothing else; a player can't read
   another player's progress; friends see each other's bests but non-friends don't; a suspended
   account gets `a2o_not_signed_in`.
7. Deploy to the Warden Chat project. The game's Sign in button then appears on its own.

To try the front end before this exists: `python3 build-artifact.py demo.html --standalone
--accounts-demo` builds the game with a pretend back end (`js/account-mock.js`) that follows this
contract; sign in as `demo` / `oranges12345`.
