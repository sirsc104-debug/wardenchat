# WikiDash accounts and friends: the back-end contract

WikiDash's account screens are finished (`src/wc/account.js`, `src/wc/friends.js`, `src/acct.js`). This
file is everything the back end has to provide for them. It follows Apples to Oranges'
[ACCOUNTS-API.md](../../new-project/ACCOUNTS-API.md) with a `wkd_` prefix, no progress document (WikiDash
keeps no save on the server beyond the wallet and its runs), and the same shared friendships.

## The big picture

- **Accounts are Warden Chat accounts**, on Warden Chat's Supabase project
  (`https://djmyvnaragfwoaljzexn.supabase.co`, the same URL and publishable key as
  `warden-chat/public/js/config.js`). Creating an account in WikiDash creates a Warden Chat account the
  way Warden Chat's own sign-up does (`<username>@warden.invalid`, the username in
  `user_metadata.username`). Supabase Auth calls are the same as in Apples to Oranges: sign in, create
  account, refresh about 90 s before expiry, sign out with `scope=local`, and `my_account_state()` after
  a refused call to show the restricted screen.
- **Coins, diamonds, membership and the Shop** are the SirSC wallet: [ECONOMY-WKD.md](ECONOMY-WKD.md).
- **Friends are shared** with Brain Rocket, Apples to Oranges and the other SirSC games: the `wkd_friend_*`
  functions use Brain Rocket's `br_friend_requests` and `br_friendships` tables (and its caps and rate
  limits). No new friendship tables.
- **Parties with friends** are in [PARTIES-WKD.md](PARTIES-WKD.md).
- Every `wkd_*` function except `wkd_ping` starts with the session check and refuses a missing session
  *or* a suspended or banned account with `wkd_not_signed_in` (reuse
  `warden_private.game_session_valid()`, as `br_assert_session()` does).
- One new migration in `warden-chat`, following that repo's conventions (RLS on, no direct table grants,
  `SECURITY DEFINER` with `set search_path = public, pg_temp`). It needs Brain Rocket's accounts
  migration and the SirSC economy migration first.

## How the front end decides accounts are switched on

On every load the game calls `wkd_ping` **without signing in** (publishable key only). A 2xx switches
on the Sign in pill (top left of the home screen), the wallet pills, coins after a win, the Shop's buy
buttons, the Friends card and parties on Warden Chat. Anything else (404 because the function doesn't
exist yet, no network) hides accounts: the game works as before. So the front end ships before the
back end.

The artifact on claude.ai can't reach Warden Chat at all (its pages may only talk to their own files),
so it ships with the pretend back end (`src/wc/mock.js`, labelled "Demo wallet"). The live builds
(`node build.mjs --live` or `--standalone`) talk to Warden Chat.

## Functions

Errors the player should see are raised as `raise exception '<code>' using errcode = 'P0001'` with
exactly these codes. **The front end treats a `br_…` code exactly like the matching `wkd_…` code**, so
the friend functions can call Brain Rocket's and let its errors through.

Grant `execute` on `wkd_ping` to `anon, authenticated`; on everything else to `authenticated` only.

### `wkd_ping() returns boolean`
Returns `true`. Exists so the front end can tell that WikiDash's migration is deployed.

### `wkd_friends() returns json`
Everything the Friends tab and the home screen's daily card need:

```jsonc
{
  "friends": [{
    "user_id": "uuid", "username": "Atlas_Reads",     // from public.profiles
    "member": true,                                   // a SirSC Member right now (shows the badge)
    "avatar": "owl",                                  // their equipped WikiDash avatar id, or null (see below)
    "daily": { "date": "2026-11-17", "clicks": 3, "ms": 42200 },   // their best daily run for today (Eastern), or null
    "party_wins": 4,                                  // party rounds they won (PARTIES-WKD.md: wkd_party_results)
    "solo_wins": 12                                   // their rewarded solo runs (wkd_runs, kind = 'solo')
  }],
  "incoming": [{ "request_id": "uuid", "username": "mia-r", "created_at": "…" }],
  "outgoing": [{ "request_id": "uuid", "username": "Owen.K", "created_at": "…" }]
}
```
- `daily` is the friend's best (fewest clicks, then fastest) `wkd_runs` row with `kind = 'daily'` and
  `date` = today in US Eastern time, else null.
- `avatar`: the last avatar the friend showed in a party (`wkd_party_members.presence->>'avatar'`, see
  PARTIES-WKD.md), only if they own it (`sirsc_owned`, game `wkd`, `item_id = 'avatar:' || avatar`),
  else null. Never an error.
- Only accepted friends appear in `friends`. Nothing about non-friends is returned except usernames on
  requests involving the caller.

### `wkd_friend_request(target_username text) returns json`
### `wkd_friend_respond(request_id uuid, accept boolean) returns void`
### `wkd_friend_cancel(request_id uuid) returns void`
### `wkd_friend_remove(friend_id uuid) returns void`
Exactly Brain Rocket's `br_friend_request`, `br_friend_respond`, `br_friend_cancel` and
`br_friend_remove` on the same tables (`{ "status": "sent" }` or `{ "status": "accepted" }` from a
request). Codes the front end explains: `user_not_found`, `self`, `already_friends`,
`already_requested`, `too_many`, `rate_limited`, `request_not_found`.

## What players can and can't see

- Your runs and wallet: only you (and your friends see your daily result, wins, badge and avatar).
- Whether a username exists: anyone signed in can find out by sending a request (as in Warden Chat).
- Nobody can list or search users.

## Checklist

1. `wkd_ping`, `wkd_friends` and the four friend wrappers, with the session check, the grants and the
   codes as written.
2. Friends through Brain Rocket's tables: a friendship made in any SirSC game shows in all of them.
3. `scripts/verify.mjs` checks: anon can call `wkd_ping` and nothing else; friends see each other's
   daily result and wins, non-friends don't; a suspended account gets `wkd_not_signed_in`.
4. Deploy. The Sign in pill then appears in the live builds by itself.
