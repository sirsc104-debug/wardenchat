# Brain Rocket accounts: the back-end contract

Brain Rocket's account screens are finished (`js/account.js`, `js/accountui.js`). This file is
everything the back end has to provide for them to work. It is written for whoever builds the back
end (Codex): build exactly this, and the front end needs no changes.

## The big picture

- **Accounts are Warden Chat accounts.** Brain Rocket signs in against Warden Chat's Supabase
  project (`https://djmyvnaragfwoaljzexn.supabase.co`, the same URL and publishable key as
  `warden-chat/public/js/config.js`). Creating an account in Brain Rocket creates a Warden Chat
  account, exactly as Warden Chat's own sign-up does (`<username>@warden.invalid` as the email, the
  username in `user_metadata.username`, so Warden Chat's `handle_new_user` trigger makes the profile).
- **There is no Brain Rocket server.** Like Warden Chat, the browser talks straight to Supabase:
  Supabase Auth for signing in, and the `br_*` Postgres functions below (called through PostgREST,
  `POST /rest/v1/rpc/<name>`) for progress and friends. All the rules live in the database.
- **Changing a password and deleting an account happen on Warden Chat only.** Brain Rocket links
  there. Nothing here changes Supabase Auth settings or Warden Chat's existing tables.
- The back end is one new migration in the `warden-chat` repo, e.g.
  `supabase/migrations/0006_brain_rocket.sql`, following that repo's conventions (RLS on, no direct
  table grants, `SECURITY DEFINER` functions with `set search_path = public, pg_temp`, every rule
  enforced in SQL).

## How the front end decides accounts are switched on

On every page load Brain Rocket calls `br_ping` **without signing in** (publishable key in the
`apikey` header only). If it gets a 2xx, the Sign in button appears. Anything else (404 because the
function doesn't exist yet, no network) hides accounts completely and the game works exactly as it
did before, saving on the device only. So the front end can ship before the back end; the button
appears the moment the migration is applied.

## Supabase Auth calls the front end makes (nothing to build)

| What | Request |
| --- | --- |
| Sign in | `POST /auth/v1/token?grant_type=password` `{ email: "<lowercased username>@warden.invalid", password }` |
| Create account | `POST /auth/v1/signup` `{ email, password, data: { username } }`; expects a session back (email confirmation must stay **off**, as Warden Chat already needs) |
| Keep signed in | `POST /auth/v1/token?grant_type=refresh_token` `{ refresh_token }`, about 90 s before the access token expires |
| Sign out | `POST /auth/v1/logout?scope=local` (this device only, so Warden Chat stays signed in elsewhere) |

The front end recognises these Auth errors: `invalid_credentials` (wrong username or password),
`user_already_exists` (username taken), `weak_password`, HTTP 429 (rate limited), and
"Database error saving new user" (the profile trigger refused the username).

## Tables

All three tables have RLS enabled and **no grants to `anon` or `authenticated`**. Every read and
write goes through the functions below. Every `user_id` references `auth.users(id) on delete
cascade`, so deleting a Warden Chat account removes its Brain Rocket data too.

```sql
-- one row per player: their whole synced progress, as one JSON document
create table public.br_progress (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  doc        jsonb not null,
  rev        integer not null default 1,
  updated_at timestamptz not null default now()
);

-- friend requests waiting for an answer
create table public.br_friend_requests (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references auth.users(id) on delete cascade,
  to_id      uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_id, to_id),
  check (from_id <> to_id)
);

-- accepted friendships, stored once per pair (smaller id first)
create table public.br_friendships (
  user_a     uuid not null references auth.users(id) on delete cascade,
  user_b     uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
```

## The progress document (`br_progress.doc`)

The front end owns this shape. The back end stores it whole, and only reads the parts the friends
list shows.

```jsonc
{
  "schema": 1,
  "bests": {                                   // best result per mode, keyed like the game's own save
    "hard":       { "score": 48210, "place": "Mars", "icon": "🔴" },
    "sub:medium": { "score": 3120,  "place": "Midnight Zone", "icon": "🦑" },
    "daily":      { "score": 1200,  "place": "Bullseye", "icon": "🎯" }
  },
  "daily": {                                   // Bullseye results by day number (#1 = 9 Oct 2026), newest 120 kept
    "2": { "day": 2, "done": true, "crashed": false, "score": 1200,
           "marks": [0,1,0,-1,2,0,0,1,0,3,0,0,1,0,4] }   // rings off per shot, -1 = miss; 0 = bullseye
  },
  "dailyStreak": { "last": 2, "count": 5 }     // day of the latest Bullseye, and the run of days ending there
}
```

**Merging is done by the browser, not the server.** The browser fetches the stored copy, merges it
with what's on the device (higher score wins for every best; for each Bullseye day, finished beats
unfinished, then more shots, then higher score; the streak with the later `last` wins, then the
higher `count`), and saves the result. The server only has to refuse a save that is based on an old
`rev` (optimistic locking), so two devices can't overwrite each other.

## Functions

All return JSON (or nothing). Errors the player should see are raised as
`raise exception '<code>' using errcode = 'P0001';` with exactly the codes listed. PostgREST
turns that into HTTP 400 `{ "code": "P0001", "message": "<code>" }`, and the front end shows the
matching message. Any other error shows "Something went wrong".

Grant `execute` on `br_ping` to `anon, authenticated`; on everything else to `authenticated` only.
Revoke from `public`. Every function except `br_ping` starts with
`if auth.uid() is null then raise exception 'br_not_signed_in' using errcode = 'P0001'; end if;`.

### `br_ping() returns boolean`
Returns `true`. Exists so the front end can tell that this migration is deployed.

### `br_get_progress() returns json`
The caller's progress: `{ "doc": <jsonb or null>, "rev": <int, 0 when no row> }`.

### `br_save_progress(doc jsonb, base_rev integer) returns json`
Saves the caller's merged progress, if nobody else has saved since the browser read `base_rev`.
- Reject unless `jsonb_typeof(doc) = 'object'` and `octet_length(doc::text) <= 65536` →
  `br_bad_progress`.
- No row yet and `base_rev = 0` → insert with `rev = 1`.
- Row exists and `rev = base_rev` → update `doc`, `rev = rev + 1`, `updated_at = now()`.
- Anything else (including the insert losing a race) → **don't raise**, return
  `{ "ok": false, "conflict": true, "rev": <current rev> }`. The browser re-reads, merges and
  tries again (up to 3 times).
- Success returns `{ "ok": true, "rev": <new rev> }`.

### `br_friends(day integer) returns json`
Everything the Friends screen and the Bullseye results need, for the caller:

```jsonc
{
  "friends": [{
    "user_id": "uuid", "username": "Sam_W",              // username from public.profiles
    "today": { "score": 1240, "bulls": 10, "done": true, "crashed": false },  // or null
    "streak": 6
  }],
  "incoming": [{ "request_id": "uuid", "username": "Owen.K", "created_at": "…" }],   // sent to the caller
  "outgoing": [{ "request_id": "uuid", "username": "mia-r",  "created_at": "…" }]    // sent by the caller
}
```
- `today` comes from the friend's `doc->'daily'->(day::text)`. Null if there is none. `score`
  is 0 when `crashed`, otherwise the stored score clamped to 0–1500. `bulls` is the number of
  `0` entries in `marks`. `done` and `crashed` are booleans (missing → false).
- `streak` is the friend's `doc->'dailyStreak'->'count'` if its `last >= day - 1`, otherwise 0.
- `day` is the caller's own Bullseye day number (players in other time zones may be a day apart;
  that's accepted).
- Only accepted friends appear in `friends`. **Nothing about non-friends is ever returned**, except
  usernames on requests that involve the caller.

### `br_friend_request(target_username text) returns json`
The caller asks someone to be friends, by Warden Chat username (matched on
`profiles.username_lower = lower(btrim(target_username))`).
- Nobody has that username → `br_user_not_found`
- It's the caller → `br_self`
- Already friends → `br_already_friends`
- The caller already asked them → `br_already_requested`
- **They already asked the caller** → delete that request, create the friendship, return
  `{ "status": "accepted" }`
- Caller has 100 friends, or 50 unanswered outgoing requests → `br_too_many`
- More than 30 requests by the caller in the last hour → `br_rate_limited`
- Otherwise insert the request and return `{ "status": "sent" }`

### `br_friend_respond(request_id uuid, accept boolean) returns void`
Only the request's recipient may answer it; anyone else, or a missing request, gets
`br_request_not_found`. The request is deleted either way, and if `accept` is true the friendship is
created (smaller uuid in `user_a`). Accepting is also subject to the 100-friend cap (`br_too_many`).

### `br_friend_cancel(request_id uuid) returns void`
Only the sender may cancel their own request (otherwise `br_request_not_found`). Deletes it.

### `br_friend_remove(friend_id uuid) returns void`
Deletes the friendship between the caller and `friend_id` if there is one. No error if there isn't.

## What players can and can't see

- Your progress document: only you (through `br_get_progress`).
- Your username, today's Bullseye summary and Bullseye streak: only people you have accepted as
  friends.
- Whether a username exists: anyone signed in can find out by sending a request. Warden Chat's
  "start new chat" already reveals the same thing.
- Nobody can list or search users.

## Checklist for the back end

1. Migration with the three tables, RLS enabled, no table grants, `on delete cascade` to
   `auth.users`.
2. The eight functions above, `SECURITY DEFINER`, `set search_path = public, pg_temp`,
   `auth.uid()` checks, the error codes exactly as written, the grants as written.
3. `br_ping` callable with only the publishable key.
4. Leave Supabase Auth settings alone (email confirmation off, as Warden Chat needs).
5. Add the new functions to `scripts/verify.mjs`: anon can call `br_ping` but nothing else; a
   player can't read another player's progress or answer someone else's request; friends see each
   other's Bullseye but non-friends don't.
6. Deploy to the Warden Chat project. Brain Rocket's Sign in button then appears on its own.
