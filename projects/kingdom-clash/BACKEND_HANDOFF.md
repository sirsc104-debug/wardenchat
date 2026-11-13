# Kingdom Clash: handoff to Codex (the back end)

**The front end is finished. The back end hasn't been started.** This file is everything Codex needs:
first a prompt to paste in, then the contract (every table, function, parameter, JSON key, error code,
Realtime policy and the checklist), then how the whole game works.

**Trophies are checked by the server.** A signed-in player's trophy battles come from the server: it picks
the opponent and the seeds, the game plays that battle, and the server replays it from the player's card
plays alone and pays the trophies. The trophies are the server's; editing a save can't change them. The
replay code is already written and tested: `server/kc-battle-core.mjs`, the game's own rules bundled for
an Edge Function.

- Repo: `sirsc104-debug/wardenchat`, branch `claude/lucid-rubin-o0imt5`, folder `projects/kingdom-clash/`
- Front end for the back end: `js/account.js` (Supabase Auth, the `kc_*` and `sirsc_*` calls, the
  `kc-battle` Edge Function, Realtime), `js/backend.js` (where it plugs into the game), `js/net.js` (rooms and
  invites), `js/game.js` (trophy battles from the server), `js/menu.js` (the screens)
- Server code, ready to import: `server/kc-battle-core.mjs`, built from the game's files and
  `server/verify.js` by `python3 build-server.py`; tested by `node tools/verify-test.js`
- Pretend back end that follows the contract: `js/account-mock.js` (demo builds only). It runs the real
  `kc-battle` logic with the same bundle, so it is also a reference for the Edge Function.

---

## The prompt (paste this into Codex)

> Build the back end for Kingdom Clash, a real-time card battler on the Warden Chat accounts, with **trophies checked by the server**. The front end (`projects/kingdom-clash/` in `sirsc104-debug/wardenchat`, branch `claude/lucid-rubin-o0imt5`) is already built against the contract below and calls Supabase directly from the browser, the same way Apples to Oranges and Wildcard Chess do. Your job, in `sirsc104-debug/warden-chat`:
> - **one new migration**;
> - **one Edge Function, `kc-battle`**, which checks trophy battles;
> - tests.
>
> Don't change the interface. If something in the contract can't work, stop and say what and why.
>
> Read `projects/kingdom-clash/BACKEND_HANDOFF.md` fully first, then build exactly what its contract specifies: names, parameters, JSON keys and error codes. It builds on:
> - the Brain Rocket accounts migration (friend requests and friendships, `br_assert_session()`);
> - the SirSC economy (`docs/ECONOMY-API.md` in `sirsc104-debug/claude`: `sirsc_wallets`, `sirsc_ledger`, `sirsc_me`, `sirsc_member_claim`), with game id `kc`.
>
> **How the trophy check works.** The battle simulation and the computer opponent are deterministic, so the same seeds and the same player plays always give the same battle. The browser never reports a result the server takes on trust:
> - `start`: the server picks the opponent and three seeds and reads the player's cards from their saved progress. It keeps all of that in `kc_battles`.
> - `finish`: the game sends only the player's card plays. The function replays the battle with the game's own code and pays the trophies for the result it computes.
> - The game's code is already bundled for you: `projects/kingdom-clash/server/kc-battle-core.mjs` (`KCServerCore.issue`, `setup`, `replay`, `settle`, `abandon`, `adopt`). Copy it into the function unchanged, and rebuild it with `python3 build-server.py` whenever the game's rules change.
> - The function refuses a game built with other rules (`kc_update_needed`).
> - `node tools/verify-test.js` in that folder shows the replay matching real battles and catching tampered plays.
>
> Conventions, as in the Apples to Oranges, Wildcard Chess and SirSC economy migrations:
> - RLS on every table and no table grants to `anon`/`authenticated`;
> - `SECURITY DEFINER` functions with `set search_path = public, pg_temp`, helpers in `warden_private`;
> - the `warden_private.game_session_valid()` session check, refusing as `kc_not_signed_in` (in the Edge Function too);
> - errors as `raise exception '<code>' using errcode = 'P0001'` (the Edge Function answers `{ "error": "<code>" }`);
> - `kc_ping` granted to `anon` and `authenticated`, everything else to `authenticated` only.
>
> What to build (the checklist at the end of the contract is the definition of done):
> 1. **Server-owned trophies**: `kc_trophies` and `kc_battles`, and the `kc-battle` Edge Function (`start` and `finish`) exactly as in *Trophy battles checked by the server*:
>    - only the function writes trophies;
>    - one open battle at a time per player, and starting another counts the open one as a loss;
>    - a battle left mid-way is a loss, except against SirSC;
>    - a player's trophies are adopted from their save once, the first time;
>    - `kc_get_progress` returns them, and `kc_exchange` reads `best` from them.
> 2. The other tables: `kc_progress` with its private history, `kc_presence`, `kc_invites`, and the private spend and exchange logs.
> 3. The other functions: `kc_ping`, `kc_get_progress`, `kc_save_progress`, `kc_friends`, `kc_friend_request`, `kc_friend_respond`, `kc_poll`, `kc_invite`, `kc_invite_respond`, `kc_spend` and `kc_exchange`. Also check that `sirsc_me` and `sirsc_member_claim` work with `game = 'kc'`.
> 4. The Realtime authorization policies for the private channels `kc-<code>`, used by battles with friends.
> 5. Wallet safety: every balance change locks the wallet row, never goes below zero, and writes a ledger row in the same transaction. `kc_spend` is idempotent on `ref`.
> 6. Tests, all passing with every existing test still passing:
>    - SQL tests like the existing ones (native PostgreSQL, no Docker);
>    - Edge Function tests, including a full battle played through `start` and `finish` (use the battles in `tools/verify-test.js` as fixtures);
>    - the `scripts/verify.mjs` checks in the checklist.
>
> Before you finish: run the full test suite, check every name and JSON key against the contract, and report what you built, what the tests checked, and anything you had to interpret. Push the branch, but don't deploy to the live Warden Chat project until SirSC says so.

---

## The contract

### The big picture

- **Accounts are Warden Chat accounts.** Kingdom Clash signs in against Warden Chat's Supabase project
  (`https://djmyvnaragfwoaljzexn.supabase.co`, the same URL and publishable key as
  `warden-chat/public/js/config.js`, Brain Rocket, Apples to Oranges and Wildcard Chess). Creating an
  account in the game creates a Warden Chat account, exactly as Warden Chat's own sign-up does
  (`<username>@warden.invalid`, the username in `user_metadata.username`, so `handle_new_user` makes
  the profile).
- **The browser talks straight to Supabase:**
  - Auth to sign in;
  - the `kc_*` SQL functions (PostgREST, `POST /rest/v1/rpc/<name>`);
  - **one Edge Function, `kc-battle`** (`POST /functions/v1/kc-battle`), for trophy battles, because
    checking one means running the game's JavaScript;
  - Supabase Realtime for battles with friends.

  Every other rule the server owns lives in the database.
- **Friends are the Warden Chat friends players already have.** Use the friendships Warden Chat's games
  already share: Brain Rocket's `br_friend_requests` and `br_friendships`, which Apples to Oranges also
  uses. If Warden Chat's own Friends feature (the one in full use) keeps friendships elsewhere, use that
  instead and say so; the front end only needs the JSON below. No new friendship tables.
- **Diamonds, coins and membership are the SirSC wallet's**, with game id `kc`. The game shows what
  `sirsc_me('kc')` says. The server takes diamonds (`kc_spend`) or coins (`kc_exchange`) **before** a
  purchase in the game goes through. The game never pays out coins or diamonds: there is no `kc_reward`.
  Diamonds are bought or granted on Warden Chat, as today.
- **Trophies are the server's.** A signed-in player's trophies, best trophies, record and streak live in
  `kc_trophies` and change only through `kc-battle`, from battles the server issued and replayed itself
  (see *Trophy battles checked by the server*). The game shows what the server says: whatever a save
  holds, the next sync puts the server's numbers back.
- **The progress document is the player's own save**, like Apples to Oranges' bests. It holds **Rubies**
  (the in-game currency), cards, chests and everything else. The server stores it, keeps old copies,
  and refuses saves based on an old revision. It doesn't judge what is inside, except two reads:
  - `kc-battle` reads the player's deck, card levels, evolutions and King Tower from it when a battle
    starts;
  - it adopts the player's trophies from it once, the first time.
- **Banned or suspended accounts.** Every `kc_*` function except `kc_ping` refuses a restricted account
  the same way as no session: `kc_not_signed_in`. The browser then calls Warden Chat's existing
  `my_account_state()` and shows the restriction. Nothing more to build for that.
- Changing a password and deleting an account happen on Warden Chat. `user_id` columns reference
  `auth.users(id) on delete cascade`.

### How the front end decides accounts are on

On every page load the game calls `kc_ping` **without signing in** (publishable key only). A 2xx
switches accounts on:
- the Settings account row says *Sign in*;
- the Friends window and Play a Friend offer *Sign in*;
- diamonds and coins come from the wallet once a player signs in.

Anything else, such as a 404 because the function doesn't exist yet, or no network (claude.ai
artifacts can't reach Supabase), keeps everything exactly as it is today:
- saving on the device only;
- "WardenChat account: coming soon";
- Play a Friend "coming soon".

So the front end already ships, and the account features appear the moment the migration is applied.

### Supabase Auth calls the front end makes (nothing to build)

| What | Request |
| --- | --- |
| Sign in | `POST /auth/v1/token?grant_type=password` `{ email: "<lowercased username>@warden.invalid", password }` |
| Create account | `POST /auth/v1/signup` `{ email, password, data: { username } }`. Expects a session back, so email confirmation must stay **off**. |
| Keep signed in | `POST /auth/v1/token?grant_type=refresh_token` `{ refresh_token }`, about 90 s before the token expires |
| Sign out | `POST /auth/v1/logout?scope=local` (this device only) |
| Banned? | `POST /rest/v1/rpc/my_account_state` after a `kc_*` call says `kc_not_signed_in` |

The front end applies Warden Chat's own rules before asking: names of 3–24 characters
`[a-zA-Z0-9_.-]`, passwords of at least 10. It recognises these Auth errors:
- `invalid_credentials`
- `user_already_exists`
- `weak_password`
- HTTP 429
- "Database error saving new user"

The session is kept in `localStorage['kc.session']`.

### Tables

RLS enabled and **no grants to `anon` or `authenticated`** on any of them: every read and write goes
through the functions.

```sql
-- the player's progress: one JSON document (the game's save), with a revision for optimistic locking
create table public.kc_progress (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  doc        jsonb not null check (jsonb_typeof(doc) = 'object' and octet_length(doc::text) <= 131072),
  rev        integer not null default 1 check (rev > 0),
  updated_at timestamptz not null default now()
);
-- every copy a save replaces, so no progress is ever lost (keep the last 20 per player)
create table warden_private.kc_progress_history (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  doc jsonb not null, rev integer not null, replaced_at timestamptz not null default now()
);
-- who has the game open: seen_at from kc_poll, about every 8 s (30 s in a background tab)
create table public.kc_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status  text not null check (status in ('lobby', 'battle')),
  seen_at timestamptz not null default now()
);
-- battle invites between friends: the room code to join
create table public.kc_invites (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references auth.users(id) on delete cascade,
  to_id      uuid not null references auth.users(id) on delete cascade,
  code       text not null check (code ~ '^[a-z0-9]{5}$'),
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now()
);
-- diamonds spent in the game (idempotent on ref), and coins swapped for Rubies per UTC day
create table warden_private.kc_spends (
  user_id uuid not null references auth.users(id) on delete cascade,
  ref text not null, kind text not null, diamonds integer not null check (diamonds > 0),
  created_at timestamptz not null default now(), primary key (user_id, ref)
);
create table warden_private.kc_exchanges (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null, coins integer not null default 0 check (coins >= 0), primary key (user_id, day)
);
-- trophies, owned by the server: written only by the kc-battle Edge Function
create table public.kc_trophies (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  trophies   integer not null default 0 check (trophies >= 0),
  best       integer not null default 0 check (best >= trophies),
  w integer not null default 0, l integer not null default 0, d integer not null default 0,   -- trophy-battle record
  streak     integer not null default 0,        -- + wins in a row, - losses in a row (matchmaking uses it)
  updated_at timestamptz not null default now()
);
-- every trophy battle the server issued: what the game needs to play it, and what the replay found
create table public.kc_battles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  rules       text not null,                     -- the rules version it was played with
  seed        bigint not null, bot_seed bigint not null, foe_seed bigint not null,   -- 0 to 2^32 - 1
  foe         jsonb not null,                    -- KCServerCore.issue(...)
  setup       jsonb not null,                    -- KCServerCore.setup(doc): the player's side
  status      text not null default 'open' check (status in ('open', 'finished', 'abandoned', 'invalid')),
  plays       jsonb,                             -- what the game sent
  result      jsonb,                             -- the replay: { ok, winner, crowns, reason, tick } or { ok: false, error, at }
  trophies_before jsonb, trophies_after jsonb,   -- kc_trophies before and after
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index on public.kc_battles (user_id, status);
```

Invites older than **120 seconds** count as expired. Old invites, and presence rows older than a day,
can be cleaned up by whatever cleanup the other games use.

### The progress document (`kc_progress.doc`)

The front end owns this shape. It is the game's save (`localStorage['kc.progress']`), without the parts
that stay on each device:
- `log`: the last 20 battles with replays;
- `live`: a trophy battle in progress;
- `abandoned`, `passRolled`;
- the wallet's mirrors: `diamonds`, `wallet` (coins) and `member`.

It also carries `"kcSchema": 1`. A real save is about 5 KB; the limit is 128 KB. What the server reads
from it:
- **`kc-battle`** reads it through `KCServerCore.setup(doc)` (deck, card levels, evolutions, King Tower)
  when a battle starts. The game saves first, so the copy is current. The first time, it also reads it
  through `KCServerCore.adopt(doc)` for the trophies. After that, the `trophies`, `best`, `trophyRecord`
  and `streak` in the document are just the game's copy of `kc_trophies`, and the server ignores them.
- **`kc_exchange`** reads `best` from `kc_trophies`, or from `doc->>'best'` while the player has no
  `kc_trophies` row yet.

The full field list is in *How the game works* below.

**Merging is done by the browser.** The browser reads the stored copy (`kc_get_progress`), and the copy
with more progress wins. It compares, in order:
1. experience (`xp`);
2. `best`;
3. total card levels;
4. total copies;
5. `rubies`.

It then either loads the winner, keeping the copy it gave up in `localStorage['kc.progress.backup']`,
or saves the winner with the revision it read. A device that holds another account's progress keeps
it under `kc.progress.of.<user id>` and hands it back when that account signs in. The server only has
to refuse a save based on an old `rev`, and keep the copies it replaces (`kc_progress_history`).

### Functions

All return JSON, or nothing. Every function except `kc_ping` starts with the session check
(`kc_not_signed_in` for no session or a restricted account). Errors the player should see are raised
as `raise exception '<code>' using errcode = 'P0001'`; PostgREST turns that into HTTP 400
`{ "code": "P0001", "message": "<code>" }`. **The front end treats a `br_…` code like the matching
`kc_…` code**, so the friend functions can call Brain Rocket's and let its errors through. Any other
error shows "Something went wrong".

#### `kc_ping() returns boolean`
Returns `true`. Callable with only the publishable key.

#### `kc_get_progress() returns json`
`{ "doc": <jsonb or null>, "rev": <int, 0 when no row>, "trophies": <kc_trophies row or null> }`
- `trophies` is `{ "trophies", "best", "w", "l", "d", "streak" }`, or `null` before the player's first
  checked battle.
- **The key must always be there.** Its presence tells the game that trophies are checked: from then
  on every trophy battle goes through `kc-battle`, and the game takes these numbers over its own.

#### `kc_save_progress(doc jsonb, base_rev integer) returns json`
- `doc` must be an object of at most 131,072 bytes (`octet_length(doc::text)`); otherwise `kc_bad_progress`.
- No row and `base_rev = 0` → insert with `rev = 1`.
- Row exists and `rev = base_rev` → copy the old `doc`/`rev` into `warden_private.kc_progress_history`,
  then update `doc`, `rev = rev + 1`, `updated_at = now()`.
- Anything else, including an insert that loses a race → **don't raise**; return
  `{ "ok": false, "conflict": true, "rev": <current rev> }`. The browser re-reads, merges and tries again.
- Success → `{ "ok": true, "rev": <new rev> }`.
- At most 120 saves a minute per player → `kc_rate_limited`. The game sends at most one every 2 s.

#### `kc_friends() returns json`
```jsonc
{
  "friends":  [{ "user_id": "uuid", "username": "Sam_W", "online": true, "in_game": false }],
  "incoming": [{ "request_id": "uuid", "username": "Owen.K", "created_at": "…" }],   // sent to the caller
  "outgoing": [{ "request_id": "uuid", "username": "mia-r",  "created_at": "…" }]    // sent by the caller
}
```
- `username` comes from `public.profiles`.
- `online`: the friend's `kc_presence.seen_at` is within the last 90 seconds.
- `in_game`: online with `status = 'battle'`. The game shows "Playing Kingdom Clash".
- Only accepted friends appear in `friends`. Nothing about non-friends is ever returned, except
  usernames on requests that involve the caller.

#### `kc_friend_request(target_username text) returns json`
#### `kc_friend_respond(request_id uuid, accept boolean) returns void`
These are exactly Brain Rocket's `br_friend_request` and `br_friend_respond` (or the Warden Chat
equivalents), with the same caps, rate limit and results. A request returns `{ "status": "sent" }`, or
`{ "status": "accepted" }` when the other player had already asked. A wrapper is fine.

The codes the game explains, as `kc_…` or `br_…`:
- `user_not_found`
- `self`
- `already_friends`
- `already_requested`
- `too_many`
- `rate_limited`
- `request_not_found`

#### `kc_poll(status text) returns json`
Called about every 8 seconds while the game is open and signed in (every 30 s in a background tab).
- `status` is `lobby` or `battle`; anything else counts as `lobby`.
- Upserts `kc_presence` (`seen_at = now()`).
- Returns:
```jsonc
{ "invites": [{ "invite_id": "uuid", "from": { "user_id": "uuid", "username": "pal" }, "code": "k7m2q", "created_at": "…" }],
  "requests": 1 }   // incoming friend requests waiting (the Friends button's dot)
```
`invites` lists the `pending` invites to the caller that are under 120 s old, newest first.

#### `kc_invite(friend_id uuid, code text) returns json`
The caller made a room (`code`, 5 characters `[a-z0-9]`) and invites a friend to it.
- Not friends → `kc_not_friends`.
- Bad code → `kc_bad_code`.
- More than 10 invites a minute → `kc_rate_limited`.
- An older `pending` invite from the caller to the same friend becomes `cancelled`.
- Returns `{ "invite_id": "uuid" }`.

#### `kc_invite_respond(invite_id uuid, accept boolean) returns void`
The invited player accepts (the game then joins the room) or declines.
- The invite must be to the caller; otherwise `kc_invite_not_found`.
- Only a `pending` invite changes, to `accepted` or `declined`.

#### `sirsc_me(game text)` and `sirsc_member_claim(game text)`, with `game = 'kc'`
These are the SirSC economy's functions, unchanged. The game reads `coins`, `diamonds` and `member`
from `sirsc_me('kc')`, and calls `sirsc_member_claim('kc')` for members, reading
`{ me, diamonds_added, claimed }`. There are no `kc` catalog rows (Kingdom Clash sells no cosmetics
through the wallet). Check that both work with `game = 'kc'` and no catalog rows.

#### `kc_spend(kind text, diamonds integer, ref text) returns json`
Takes diamonds from the caller's SirSC wallet for a purchase in the game, **before** the game hands
it over.
- `ref` is a random id from the browser (at most 64 characters). A `ref` already in
  `warden_private.kc_spends` → take nothing and return
  `{ "ok": true, "spent": 0, "repeated": true, "me": <sirsc_me('kc')> }`.
- `kind` and `diamonds` must match this table; otherwise `kc_bad_spend`:

| kind | diamonds | what it is in the game |
| --- | --- | --- |
| `pass` | exactly 10 | the week's Diamond Pass (`PASS.price`) |
| `skip` | 1 to 144 | opening a chest now: 1 per 5 minutes of its timer left (a Mythic is 12 h, so 144) |
| `offer` | 1 to 2 | a daily Shop offer paid in diamonds (the Mega bundle, the 5,000-Ruby bundle) |
| `deal` | 1 to 18 | Daily Deals (2 and 6, scaled by arena between ×0.5 and ×3) |
| `magic` | 1 to 25 | a Magic Shop item (Common Wild Cards 1 … the Hammer of Books 25) |
| `cards` | 1 to 10 | a Card Shop pack (common 2, rare 3, epic 6, legendary 10) |
| `emote` | exactly 1 | an emote |

- Fewer diamonds than `diamonds` → `kc_not_enough_diamonds`, and nothing is taken.
- At most 120 spends an hour → `kc_rate_limited`.
- Otherwise:
  1. lock the wallet row;
  2. take the diamonds;
  3. write the `kc_spends` row and a ledger row (`spend`, game `kc`, note = `kind`) in the same
     transaction;
  4. return `{ "ok": true, "spent": <diamonds>, "me": <sirsc_me('kc')> }`.

The server can't know what was bought. What it guarantees is that diamonds are never created, never
go below zero, and every spend is in the ledger.

#### `kc_exchange(coins integer) returns json`
Swaps wallet coins for Rubies, **one way**, at 1 coin = 1 Ruby, up to a daily limit that depends on
the highest arena the player has reached.
- `coins` must be a whole number from 1 to 10,000; otherwise `kc_bad_amount`.
- The arena comes from `best`:
  - `kc_trophies.best`;
  - or, while there is no `kc_trophies` row, `(kc_progress.doc->>'best')::int`;
  - 0 when there is neither or it isn't a number.

| best trophies | 0 | 300 | 600 | 900 | 2,000 | 2,600 | 3,300 | 4,100 | 5,000 | 6,000 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| arena | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| coins a day | 500 | 1,000 | 2,000 | 4,000 | 6,000 | 7,000 | 8,000 | 9,000 | 10,000 | 10,000 |

- The coins swapped today (UTC) plus `coins` must stay within the limit; otherwise
  `kc_exchange_cap`. The table is `ECONOMY.exchange` in `js/progress.js`.
- Fewer coins than `coins` → `kc_not_enough_coins`.
- Otherwise:
  1. lock the wallet row;
  2. take the coins;
  3. add them to `warden_private.kc_exchanges`;
  4. write a ledger row (`exchange`, game `kc`);
  5. return `{ "ok": true, "coins": <n>, "rubies": <n>, "used": <today's total>, "cap": <limit>, "me": <sirsc_me('kc')> }`.

  The game adds the Rubies to the save.

### Trophy battles checked by the server: the `kc-battle` Edge Function

The battle simulation (`js/sim.js`) is deterministic: exact arithmetic, seeded randomness, no clock. So
is the computer opponent (`js/bot.js`), given its seed. So a battle is fully decided by:
1. the opponent;
2. three seeds;
3. the player's side;
4. the player's own card plays.

The server picks 1–3 and reads 3 from the save; only 4 comes from the browser. The server replays the
battle with the game's own code and pays trophies for **its** result. The game's claimed result is
only logged.

**The code is done.** `server/kc-battle-core.mjs` is an ES module (Deno or Node) holding the game's
`cards`, `trainers`, `sim`, `bot` and `progress` files with `server/verify.js`. `import { KCServerCore }
from './kc-battle-core.mjs'` gives:

| Call | Returns |
| --- | --- |
| `KCServerCore.RULES` | the rules version (12 hex characters), the same one the game sends |
| `adopt(doc)` | `{ trophies, best, w, l, d, streak }` from a save: a player's trophies the first time |
| `roadOpen(doc)` | whether the save has the Trophy Road open (Trainer Luc beaten) |
| `setup(doc)` | `{ deck, cardLevels, evos, king }`: the player's side, from the save |
| `issue(trophies, foeSeed)` | the opponent (JSON): what the game's matchmaking gives at these trophies, SirSC included |
| `replay({ seed, botSeed, setup, foe, plays, end })` | `{ ok: true, winner, crowns, reason, tick }`, or `{ ok: false, error, at }` when a play can't have happened |
| `settle(trophies, foe, winner, crowns)` | the trophies after a result, by the game's rules: stakes 20–40, arena floors, streaks, SirSC costs nothing; plus `delta` and `boss` |
| `abandon(trophies, foe)` | the same for a battle that was left: a loss (nothing against SirSC) |
| `clean(trophies)` | a trophy object with junk numbers fixed |

In the game's terms, `winner` is 0 (the player), 1 (the opponent) or −1 (a draw), and `crowns` is
`[player, opponent]`. A replay takes about 0.1 s of CPU (6,000–7,000 steps). Each call loads its own
copy of the rules, so requests never share state.

**`POST /functions/v1/kc-battle`.** The player's access token is in `Authorization: Bearer`, the
publishable key in `apikey`, and the body is JSON. Answer CORS preflight (`OPTIONS`) for the game's
origin. Use the service role inside the function, and check the caller's session the way the SQL
functions do. Errors are HTTP 4xx with `{ "error": "<code>" }`: `kc_not_signed_in` (401), the others
400 or 409 as noted.

**`{ "action": "start", "rules": "<version>" }`** begins a trophy battle. In one transaction, with the
player's `kc_trophies` row locked:
1. `rules` must equal `KCServerCore.RULES`; otherwise `kc_update_needed` (409). The game then says a
   new version is out.
2. Read `kc_progress.doc`; no row → `kc_no_progress`. `KCServerCore.roadOpen(doc)` false →
   `kc_road_closed`.
3. Get the trophies:
   - the `kc_trophies` row;
   - or, the first time, `KCServerCore.adopt(doc)`, inserted as the row.
4. **Settle every `open` battle of the player as `abandoned`.** For each, update the trophies to
   `KCServerCore.abandon(trophies, foe)`, so starting a new battle never dodges a loss.
5. Pick `seed`, `bot_seed` and `foe_seed`: random whole numbers from 0 to 2^32 − 1, from a secure
   source. Then compute:
   - `foe = KCServerCore.issue(trophies, foe_seed)`;
   - `setup = KCServerCore.setup(doc)`.
6. Insert the `kc_battles` row (`open`). At most 120 battles an hour → `kc_rate_limited`.
7. Return:

```jsonc
{ "battle_id": "uuid", "seed": 3052700269, "bot_seed": 1830022651, "foe": { ... }, "setup": { ... },
  "trophies": { "trophies": 1500, "best": 1600, "w": 60, "l": 50, "d": 0, "streak": 0 } }
```

The game plays exactly that battle and shows those trophies.

**`{ "action": "finish", "battle_id": "uuid", "plays": [[tick, slot, x, y, card], ...], "end": null | { "tick": n, "reason": "surrender" } | { "reason": "left" }, "claimed": { "winner", "crowns" } }`**
ends one. In one transaction, with the battle row and the `kc_trophies` row locked:
1. The battle must be the caller's and `open`; otherwise `kc_battle_closed` (409). Accept it for 24
   hours after `created_at`: the game resends a finish it couldn't deliver before its next battle.
2. `plays` is at most 1,500 entries (otherwise `kc_bad_request`). `end` and `claimed` are as shown.
3. Work out the result:
   - `end.reason = 'left'` (the page was closed or reloaded mid-battle) → `abandoned`, settled with
     `KCServerCore.abandon`.
   - Otherwise `r = KCServerCore.replay({ seed, botSeed: bot_seed, setup, foe, plays, end })`:
     - `r.ok` → `finished`, `KCServerCore.settle(trophies, foe, r.winner, r.crowns[0])`;
     - not ok (a play that can't have happened: a card not in that slot, energy it didn't have, a
       wrong place, plays out of order or after the end) → `invalid`, settled as a loss with
       `abandon`, and kept for review.
4. Store `plays`, `result`, `trophies_before`, `trophies_after` and `finished_at`. Update `kc_trophies`.
5. Return:

```jsonc
{ "battle_id": "uuid", "verified": true, "winner": 1, "crowns": [0, 3], "reason": "king", "delta": -34, "boss": false,
  "trophies": { "trophies": 1466, "best": 1600, "w": 60, "l": 51, "d": 0, "streak": -1 } }
```

`verified` is false for `left` and `invalid`.

**Battles nobody finishes.** An `open` battle is settled as `abandoned`:
- when the same player starts their next one (step 4 above);
- or by a cleanup more than 24 hours after `created_at`.

**What the game does around it** (already built):
- **Signed out**, or `kc_get_progress` without the `trophies` key: trophy battles are local, as
  before.
- **Signed in:** before `start` the game sends its latest save, so `setup` matches it.
- **Offline:** without a connection trophy battles wait (Practice works offline).
- **Results:** the result screen shows the game's own count at once, then takes the server's (they
  are the same unless the save was tampered with).
- **A finish that can't be sent** waits on the device and goes before the next `start`.
- **A battle left by a reload** is sent as `{ "reason": "left" }` when the game next loads.
- **Not deployed:** if `kc-battle` answers 404, the game plays the battle locally. Deploy it together
  with the migration.

**Rules versions.** `KCServerCore.RULES` is a hash of the files that decide a battle (`js/cards.js`,
`js/sim.js`, `js/bot.js`, `js/progress.js`). The game's build stamps the same hash and sends it with
`start`. **Whenever those files change, run `python3 build-server.py` and redeploy the function with
the new `server/kc-battle-core.mjs`.** Until then the new game gets `kc_update_needed`, so nobody's
battle is checked with the wrong rules. Battles already issued keep their own `rules`, so the function
can keep older bundles alongside if a release ever needs a changeover window.

### Battles with friends: Supabase Realtime

A battle between two friends runs in both browsers: the same deterministic simulation from the same
seed, with only card plays sent across (lockstep; see *How the game works*). The server keeps no
battle state: Realtime relays the messages.

- **One private channel per room**, topic `kc-<code>`, where `code` is 5 characters from
  `abcdefghjkmnpqrstuvwxyz23456789`. The browser joins with supabase-js 2.45.4 (loaded on demand from
  jsDelivr; set `supabaseJs` in `KCAccount.configure` to host it yourself if Warden Chat's CSP needs
  that):
  `channel('kc-' + code, { config: { private: true, broadcast: { self: false }, presence: { key } } })`,
  after `realtime.setAuth(<the player's access token>)`.
- **What to build: the Realtime Authorization policies** on `realtime.messages`, so signed-in players
  with a valid session can use those channels and nothing else changes:
```sql
create policy "kc rooms: read" on realtime.messages for select to authenticated
  using (realtime.topic() ~ '^kc-[a-z0-9]{5}$' and warden_private.game_session_valid());
create policy "kc rooms: write" on realtime.messages for insert to authenticated
  with check (realtime.topic() ~ '^kc-[a-z0-9]{5}$' and warden_private.game_session_valid());
```
  These cover both broadcast and presence. Anyone signed in who knows a room's code can join it, the
  same as Wildcard Chess's codes. The game itself checks everything a peer sends.
- **What travels** (nothing to build; for sizing):
  - **Presence**: each player's setup: name, deck, card levels, King Tower, evolutions, trophies, arena.
  - **Broadcast** events, each with payload `{ f: <sender's presence key>, d: <data> }`:
    - `mp.start`: from the host, once a second until the guest's first message;
    - `mp.step`: each player's plays, about 15 a second each;
    - `mp.emote`;
    - `mp.bye`.

  So a battle is about 30 small messages a second for about 3–4 minutes. Check the project's Realtime
  quota (messages per second, concurrent channels) for the number of battles expected.
- Battles with friends pay nothing: no trophies, chests, Rubies or experience. Nothing to record, and
  nothing for `kc-battle` to check.

### What players can and can't see

- Your progress document: only you.
- Your username, and whether you are online or in a battle: only your accepted friends.
- An invite: only its sender and the friend it went to. Its code lets anyone signed in join that room
  for as long as it is open.
- Nobody can list or search users. Whether a username exists can be found by sending a friend request,
  as in Brain Rocket and Warden Chat.

### Checklist

1. **Server-checked trophies:**
   - `kc_trophies` and `kc_battles`;
   - the `kc-battle` Edge Function with `start` and `finish` exactly as specified, using
     `server/kc-battle-core.mjs` unchanged;
   - `kc_get_progress` always returns the `trophies` key;
   - `kc_exchange` reads `best` from `kc_trophies`.

   Test it:
   - a full battle through the function (the `tools/verify-test.js` battles as fixtures) pays what
     `settle` says;
   - a tampered play gives `invalid` and a loss;
   - `left` is a loss;
   - SirSC losses cost nothing;
   - starting while a battle is open counts it as lost;
   - the first battle adopts the save's trophies;
   - a wrong `rules` gets `kc_update_needed`;
   - nothing but the function writes `kc_trophies`.
2. One migration in `sirsc104-debug/warden-chat`:
   - the tables above, with RLS on, no table grants, `on delete cascade`;
   - the functions above, `SECURITY DEFINER`, `set search_path = public, pg_temp`, with the session
     check;
   - the error codes and JSON keys exactly as written;
   - `execute` granted to `authenticated`, plus `anon` on `kc_ping`.
3. `kc_save_progress`: optimistic locking on `rev`, a conflict returned (not raised), the replaced copy
   kept in `kc_progress_history`.
4. Friends through the existing friendships: a friendship made in any Warden Chat game shows here.
   `online` and `in_game` come from `kc_presence`.
5. Invites: only to friends, expire after 120 s, a newer one cancels the older one to the same friend,
   only the invited player can answer.
6. Wallet:
   - `kc_spend` and `kc_exchange` lock the wallet row, never go below zero, and write the ledger row
     in the same transaction;
   - `kc_spend` is idempotent on `ref` and enforces the kind table;
   - `kc_exchange` enforces the arena limit per UTC day;
   - `sirsc_me` and `sirsc_member_claim` work with `game = 'kc'`.
7. Realtime policies: a signed-in player can join `kc-abcde` and a restricted or anonymous one can't.
8. Tests (native PostgreSQL, no Docker), with the existing tests still passing. Cover:
   - save, conflict, history;
   - friends' visibility, presence;
   - invites: expiry, cancel, respond, not friends;
   - spends: each kind's limits, idempotency, not enough diamonds;
   - exchange: limit by arena, UTC day, not enough coins;
   - restricted accounts refused.
9. `scripts/verify.mjs` checks:
   - anon can call `kc_ping` but nothing else;
   - a player can't read another player's progress or trophies, and nobody can write `kc_trophies` or
     `kc_battles` except through `kc-battle`;
   - non-friends don't see each other's presence;
   - a suspended account gets `kc_not_signed_in`.
10. Leave Supabase Auth settings alone (email confirmation stays off).
11. Deploy the migration and the function together, once SirSC says so. Nothing changes in the game:
    accounts appear on their own once `kc_ping` answers, and trophy battles are checked from then on.

**Trying the front end before the back end exists:**
`python3 build-artifact.py demo.html --standalone --accounts-demo` builds the game with the pretend
back end. Sign in as `demo` / `kingdom12345`; `pal` and `sam` have the same password.
- Open a second tab and sign in as `pal` (each tab keeps its own session).
- Invite pal from demo's Friends window; accepting in pal's tab starts a battle between the two tabs.
- Trophy battles there go through the pretend `kc-battle`, which checks them with the real bundle.
- The two tabs share one progress save in the demo; real players each have their own.

---

## How the game works

### The project

- **What it is:** an original real-time card battler (two lanes across a river with two bridges, eight-card
  decks, elixir-like *energy*). All names, art and sounds are original, drawn or synthesised in code
  except the arena images in `img/`.
- **Stack:** plain HTML, CSS and JavaScript, no dependencies, no build step for development (open
  `index.html`).
- **Script order** (as `index.html` loads them):
  1. `backend`, `cards`, `trainers`, `sim`, `progress`, `bot`;
  2. `arenas`, `art`, `art2`–`art5`, `scenery`, `audio`, `items`, `upgrades`;
  3. `net`, `menu`, `emotes`, `game`, `account`.
- **The server's copy of the rules:** `python3 build-server.py` writes `server/kc-battle-core.mjs` (see
  *Trophy battles checked by the server*).
- **Builds:** `python3 build-artifact.py OUT.html [--standalone] [--accounts-demo]` inlines everything
  into one file. Images become data URIs; it must stay under 16 MB and is about 13.4 MB.
  - `dist/kingdom-clash.html`: the claude.ai artifact build.
  - `dist/kingdom-clash-standalone.html`: a complete page; host it anywhere, e.g. on the Warden Chat
    domain.
  - The artifact on claude.ai can't reach Supabase, so accounts stay off there. For the live game,
    host the standalone file (or the folder) on the Warden Chat domain.
- **Tests** (Node, headless): `node tools/<name>.js`:
  - `progress-test`, `trainers-test 100`, `cards-test`, `sim-test 40`, `path-test`;
  - `verify-test` (the server's replay of trophy battles: it builds `server/kc-battle-core.mjs` first);
  - `arenas5-10-test`, `expansion-test`, `evo-test`;
  - `balance-test` (balance report).

  `tools/economy-report.js` prints the economy.
- **Rules the project keeps:**
  - Spenders get no hidden win-rate boost.
  - Rubies and Coins never turn into Diamonds.
  - Never reset player data: saves are upgraded in place.
  - Desktop and Chromebook first, and everything works at phone width.

### The battle (`js/sim.js`, `js/bot.js`, `js/game.js`)

- **The simulation** (`KCSim`): 30 steps a second, no DOM, exact arithmetic only, seeded with a
  mulberry RNG. The same options and the same plays at the same ticks always give the same battle, in
  any browser or in Node.
  - `S.create(opts)`: opts are `seed`, `decks` [2×8], `cardLevels` [2×{id: level}], `levels` (King
    Tower levels), `evos`, `towerDamage`, and the challenge flags `energyMult` and `firstTower`.
  - `S.step(s)` advances one step; `S.play(s, team, slot, x, y)` makes a play.
  - `s.log` records every play as `[tick, team, slot, x, y, card]`.
- **Matches:** three minutes, then overtime, then sudden death.
  - Sudden death drains the towers until one falls.
  - Crowns come from towers: the King Tower is worth three.
  - Ends: `king`, `crowns`, `overtime`, `sudden`, `surrender`, `left`, `desync`.
- **The computer player** (`KCBot`): deterministic given its seed (no `Math.random`, no clock).
  - Its skill comes from the opponent's trophies (`FOE_SKILL`), with play styles and deck rules
    (`STYLES`, `buildDeck`).
  - The game loop each frame: `S.step` → `KCBot.update` → the player's plays between frames at the
    current tick.
- **Replays:** a battle-log entry keeps the sim options and every play. A replay applies the plays with
  `tick <= s.tick` before each step and reaches the same result. This is also how a server could one
  day verify trophy battles: replay them in Deno or Node with `js/sim.js`, which runs unchanged.
- **Battles with friends** (`js/net.js` for rooms and invites, `js/game.js` for lockstep):
  - The host is team 0; the guest sees the battle mirrored.
  - A play made at tick *t* is applied at *t* + 9 on both screens. A screen runs tick *t* only once it
    knows the other has sent every play up to *t*.
  - Each `mp.step` message `{ u, p: [[seq, at, card, x, y]…], a, h: [tick, hash] }` repeats every play
    the other side hasn't acknowledged.
  - A checksum is compared every two seconds; a mismatch ends the battle as *out of sync*.
  - A player who leaves (`mp.bye`, or silence for 12 s) loses.
  - `mp.start` is `{ to, seed, host, guest, theme }`, where `host` and `guest` are the two setups.
  - Everything a peer sends is checked (`checkSetup`, play validation).

### Progress (`js/progress.js`, `KCProgress`)

All the rules are here, with no screen code. Every change calls `save()`, which writes
`localStorage['kc.progress']` and hands a copy to `KCBackend.saved` (the cloud save).

- **Training Grounds:** Trainer Owen (the tutorial), then Romeo, then Luc. Beating Luc opens the
  Trophy Road. Trainer matches use only the starter cards.
- **Trophies and matchmaking:**
  - A battle is worth 30 either way against an equal opponent. Every 10 trophies of difference
    shifts it by 1, always between 20 and 40 (`TROPHIES`, `stakes`).
  - Opponents are found about 35 trophies below the player (`MATCH`), so a player holds steady
    winning about 55–56% and climbs as their cards and play improve.
  - Losing streaks bring easier opponents (a *breather*); winning streaks bring level ones.
  - Opponents' card levels follow their trophies (`ECONOMY.foeLevels`), so cards that fall behind
    hold a player back.
  - The first 3 trophy battles are against beginners (`FIRST_STEPS`).
  - **No hidden handicaps either way.**
  - A trophy battle left unfinished (reload, closed tab) counts as a loss at the next load (`live`).
  - **Signed in, the server checks every trophy battle** and keeps the trophies (`kc-battle` above). The
    game builds the battle with `KCProgress.trophyBattleOpts(foe, setup, seed)`, the same function the
    server's replay uses, and takes the server's numbers with `KCProgress.setTrophies`.
- **SirSC:** from 4,100 trophies, about 1 trophy battle in 25 is against SirSC (`SIRSC`).
  - Every card and his King Tower are at level 50, with the best play.
  - Losing to him costs no trophies and doesn't count toward a losing streak; leaving his battle
    costs nothing either.
  - A win pays like any other.
- **Arenas:** ten. Each has a trophy floor (trophies never drop below the floor of the arena you're
  in) and its cards, and each card is on the Trophy Road inside its arena:

| # | Arena | from |
| --- | --- | --- |
| 1 | Cinder Keep | 0 |
| 2 | Briar Hollow | 300 |
| 3 | Sunstone Arena | 600 |
| 4 | Stormspire | 900 |
| 5 | Frostfang Keep | 2,000 |
| 6 | Blackwater Harbor | 2,600 |
| 7 | Gearforge | 3,300 |
| 8 | Crystal Chasm | 4,100 |
| 9 | Skyward Sanctuary | 5,000 |
| 10 | Eclipse Throne | 6,000 |

- **Trophy Road:** fixed rewards (Rubies, chests, cards, arenas) claimed once each (`claimed`), up to
  7,000.
- **Chests:**
  - Six tiers: Wooden, Silver, Gold, Platinum, Legendary, Mythic.
  - A trophy win puts one in a free slot (four slots), in a fixed cycle of 24 (`cycle`).
  - Contents are rolled when the chest is won and stored, so reopening the game can't reroll them.
  - One chest unlocks at a time on a real-time timer (`ends`); diamonds skip the timer (`skip`).
  - Which cards can drop depends on the best trophies reached.
  - The arena gate on tiers is in `CHEST_RULES` and is on: a chest above the player's arena is given as the highest tier it allows (Arena 1: Wooden and Silver; Gold from 2, Platinum from 3, Legendary from 4, Mythic from 5), and chests in Arenas 1 to 4 hold more to make up for it (`ECONOMY.gateBoost`).
- **Cards:**
  - 70 cards: 22 spells, 12 buildings, 36 troops.
  - Rarities start at levels 1, 3, 6 and 9, up to 15.
  - An upgrade costs copies (by rarity) plus Rubies.
  - Found cards are `found`; levels and spare copies are `cards[id] = { level, count }`.
- **King Tower:** level L needs L cards at level L or higher (`king`). It sets tower health and damage.
- **Evolutions:**
  - Seven, in `KC_EVOS` in `js/cards.js`: Snowman, Archers, Wolves, Gladiator, Hawks, Gorilla and
    Fireball.
  - Each is unlocked once with 6 Evolution Shards, or from the Diamond Pass (`evos`).
  - Every 2nd or 3rd play of that card is then the evolved one.
  - They open at Sunstone Arena.
- **Currencies:**
  - **Rubies**: the game's own; they never leave it.
  - **Diamonds**: the SirSC wallet's. They pay for the Pass, chest skips, diamond offers, Daily
    Deals, the Magic Shop, the Card Shop and emotes.
  - **Coins**: the SirSC wallet's, swapped one way for Rubies within the daily limit.
  - Rubies and Coins never buy Diamonds. The game never pays out Coins or Diamonds.
- **The Shop**, made fresh each local day (`shop`):
  - five daily offers (one is a 1-diamond 5,000-Ruby bundle);
  - one free Wooden Chest;
  - chests for Rubies, one of each a day;
  - diamond-only Daily Deals, Magic Shop and Card Shop;
  - three emotes a day for 5,000 Rubies or 1 diamond.
- **Magic items** (`magic`): Wild Cards (count as copies of their rarity), Books (fill a level's
  copies), the Hammer of Books (a free level), and Evolution Shards.
- **The Diamond Pass** (`pass`):
  - A week long, Monday to Monday. Seasons are numbered from Monday 5 January 2026.
  - Every crown from a trophy battle is a point, and 8 points make a tier, for 15 tiers.
  - Each tier has a free reward and a paid one. The paid track costs 10 diamonds a week; members
    get it free.
  - Tier 1's paid reward is the week's featured evolution, a different one each week.
  - When a week ends, unclaimed reached rewards are added for you.
- **Daily** (each of these resets with the local day):
  - Three quests (`quests`).
  - The crown chest: 10 crowns opens a Silver Chest (`crownDay`).
  - Win Rubies for the first 20 wins (`winDay`).
  - Win streaks of 3 or more double the win Rubies.
  - The daily challenge, in turn: Triple Energy, Sudden Death, Draft, Mirror, Random Decks. The first
    3 wins each give a chest; no trophies are won or lost.
- **Practice** (a free battle, or *Try it* with any card) and **ghost battles** from friend codes
  (`KCF1-…`: battle a computer playing a friend's deck) win and lose nothing.
- **Deck codes:** `KC1-` plus 16 characters. There are five deck slots (`decks`, `deckSlot`).
- **Profile:** name, avatar (a found card), stats, and a battle log of 20 battles with replays.

**The save's fields** (`kc.progress`); the ones marked † stay on the device and are not in the cloud
document:

| Field | What it holds |
| --- | --- |
| `name`, `avatar`, `xp` | the player's name, avatar card, experience (level = 1 + xp / 100) |
| `beaten`, `records`, `opp`, `mode`, `tutorial`, `roadSeen`, `hints` | Training Grounds progress, the guided first battle and one-time hints |
| `trophies`, `best`, `trophyRecord`, `streak` | trophies now and best ever, wins/losses/draws, the current streak (+ wins, − losses) |
| `claimed`, `cycle`, `chests` | Trophy Road rewards claimed; where the chest cycle is; the four chest slots `{ type, state, ends, contents }` |
| `rubies` | Rubies |
| `cards`, `found`, `deck`, `decks`, `deckSlot`, `king`, `evos`, `magic` | card levels and copies, found cards, the decks, King Tower level, evolutions, magic items |
| `shop`, `freeChestDay`, `chestBuys`, `emotes`, `emoteShop` | today's Shop, the free chest, chests bought today, owned emotes, today's emote offers |
| `pass` | `{ season, points, premium, free: {tier: true}, paid: {tier: true}, weekly }` |
| `quests`, `crownDay`, `winDay`, `challenge`, `walletDay` | today's quests, crown chest, win Rubies count, challenge wins, coins swapped today (as the game counts them) |
| `stats` | battles, wins, three-crown wins, plays per card |
| `log` † | the last 20 battles with replays |
| `live` †, `abandoned` †, `passRolled` † | a trophy battle in progress (counted as a loss if never finished); one-time notices |
| `diamonds` †, `wallet` †, `member` † | the SirSC wallet's diamonds, coins and membership, as `sirsc_me` last said (0 and false when signed out) |

### Where the back end plugs in (front end, already built)

- `js/account.js` (`KCAccount`):
  - Supabase Auth over `fetch`, with tokens refreshed 90 s early;
  - the `kc_ping` gate;
  - the cloud save: pull on sign-in, push 2 s after the last change, merge on conflict;
  - the wallet mirror: `sirsc_me` on sign-in, on returning to the tab, and every eighth poll;
  - `kc_spend` and `kc_exchange`;
  - the friends provider and `kc_poll`;
  - the Realtime room transport;
  - trophy battles: `kc-battle` `start` and `finish`, the queue of finishes waiting for a connection,
    and the server's trophies on every sync.

  Its settings are in `KCAccount.CFG`: Supabase URL and key, `supabaseJs`, poll seconds.
- `js/backend.js` (`KCBackend`) is the seam the game uses:
  - `status`, `account`, `login`, `signOut`, `saved`, `restore`;
  - `pay(kind, diamonds)`: before every diamond purchase;
  - `exchange(coins)`;
  - `friends()`, `transport()`, `wallet()`;
  - `ranked()`, `battleStart()`, `battleFinish()`: trophy battles checked by the server (used by
    `js/game.js`).
- The screens (`js/menu.js`):
  - the Settings account row (*Sign in* / *Signed in as …* / *Sign out*);
  - the sign-in window (sign in or create an account);
  - **Friends** (top bar): online first, *Battle* to invite, friend requests to accept or decline, *Add
    friend* by WardenChat name, a dot for invites and requests;
  - **Play a Friend** (lobby, from Stormspire): invite a friend, or make a room and share its code, or
    type a friend's code;
  - the invite banner (*Battle* / *Not now*).

### Not part of this handoff (later, maybe)

- **Leaderboards.** `kc_trophies` is now trustworthy, so a leaderboard can read it directly (the game
  has no screen for one yet).
- **Cards, chests and Rubies on the server.** They are still the player's own save, as in Apples to
  Oranges. Trophies are checked, but the card levels a battle is played with come from the save. The
  battle really was played and won under the game's rules, with the cards the save says. Moving chests
  and upgrades to the server would close that too.
- The **Clan** tab (shows "Soon").
- Profile pictures from Warden Chat (the game uses letter avatars).
