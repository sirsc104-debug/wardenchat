# WikiDash parties on Warden Chat: the back-end contract

Signed-in players host a party, invite friends from their Warden Chat friends list (or share the
5-letter code), and race together: four modes (race, fewest clicks, teams, elimination), 1 to 7 rounds,
host rules, reactions. The front end is finished: `src/wc/party.js` (this contract), `src/net.js` (the
party itself) and `src/engine.js` + `src/logic.js` (the rules). It builds on
[ACCOUNTS-WKD.md](ACCOUNTS-WKD.md) and follows the same conventions (one migration in `warden-chat`, RLS
on, no table grants, `SECURITY DEFINER`, the `wkd_not_signed_in` session check, `P0001` errors).

## How it works, and what the server trusts

- **The host's browser runs the rules** (`logic.js`, the same file the Cloudflare version ran on its
  server). It checks every click against the bundled link graph, keeps the clock and saves the whole
  game as one JSON document with `wkd_party_put`.
- **Everyone else sends moves through their presence.** Each player's browser calls `wkd_party_sync`
  about once a second (every 350 ms while it has something new to send) with its *presence*: a small
  JSON object holding its name, avatar, a queue of numbered moves the host hasn't confirmed yet, and its
  latest reaction. The reply carries everyone's presence and, when it changed, the latest game document.
  The host reads the queues, applies the moves in order, and confirms them in the document (`acks`).
- **The server doesn't know the rules.** It stores presence and the document, checks who may write
  the document, and keeps the member list. This is the same split as Wildcard Chess online (the server
  keeps order, the clients keep the rules).
- **If the host leaves**, the first player still here takes over from the saved document (the front end
  waits 8 s). The server allows that by letting another member write the document once the host hasn't
  synced for 10 s, and that member becomes the host.
- **No coins for party races** (two friends could trade wins). The front end says so.
- No websocket and no Realtime: polling is enough for 2 to 24 players and a click every few seconds.

## Tables

```sql
create table public.wkd_parties (
  id         uuid primary key default gen_random_uuid(),
  code       text not null check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$'),
  host_id    uuid not null references auth.users(id) on delete cascade,
  doc        jsonb check (doc is null or (jsonb_typeof(doc) = 'object' and octet_length(doc::text) <= 262144)),
  rev        integer not null default 0 check (rev >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- a code is only unique among parties that are still alive (updated in the last 6 hours)
create unique index on public.wkd_parties (code);   -- or a partial index plus cleanup; see "Cleanup"

create table public.wkd_party_members (
  party_id  uuid not null references public.wkd_parties(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  presence  jsonb not null default '{}' check (jsonb_typeof(presence) = 'object' and octet_length(presence::text) <= 4096),
  joined_at timestamptz not null default now(),
  seen_at   timestamptz not null default now(),
  primary key (party_id, user_id)
);

create table public.wkd_party_invites (
  party_id   uuid not null references public.wkd_parties(id) on delete cascade,
  from_id    uuid not null references auth.users(id) on delete cascade,
  to_id      uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (party_id, to_id)
);

-- one row per finished round, for friends' party wins (ACCOUNTS-WKD.md: wkd_friends.party_wins)
create table public.wkd_party_results (
  party_id  uuid not null references public.wkd_parties(id) on delete set null,
  round     integer not null,
  winner_id uuid references auth.users(id) on delete cascade,
  players   integer not null,
  created_at timestamptz not null default now(),
  primary key (party_id, round)
);
```

A member is **here** while `seen_at` is within the last 8 seconds. At most 24 members per party →
`wkd_party_full`. A player is in at most 3 parties at once (a membership counts while that party was
updated in the last hour) → `wkd_too_many_parties`.

## The party state

Every function that returns a party returns this, for the caller:

```jsonc
{ "party_id": "uuid", "code": "KQ3RT", "host_id": "uuid", "rev": 12, "server_now": "…",
  "doc": { ... } ,                     // the game document, only when rev > the caller's since_rev; else null
  "members": [ { "user_id": "uuid", "username": "Atlas_Reads", "member": true,
                 "presence": { ... }, "seen_ago": 1 } ] }      // seen_ago: whole seconds since their last sync
```

The document is the front end's (`{ state, clock, acks, connected, host, v }`); the server only stores
it. Presence is the front end's too (`{ pid, name, q, say }`, at most 4 KB); the server only stores it.

## Functions

### `wkd_party_create() returns json`
A new party with a fresh code; the caller is the host and first member; `doc` null, `rev` 0. Errors:
`wkd_too_many_parties`.

### `wkd_party_join(code text) returns json`
Joins by code (case-insensitive) as a member (joining again is fine). Errors: `wkd_no_such_party`
(unknown or more than 6 hours idle), `wkd_party_full`, `wkd_too_many_parties`. Deletes the caller's
invite to that party, if any.

### `wkd_party_sync(party_id uuid, presence jsonb, since_rev integer) returns json`
Stores the caller's presence (an object of at most 4 KB, else `wkd_bad_presence`) and `seen_at = now()`,
then returns the party state with `doc` only when `rev > since_rev`. Not a member →
`wkd_no_such_party`. This is the hot path: one row update and one read, no locks on the party row.

### `wkd_party_put(party_id uuid, doc jsonb) returns json`
Saves the game document: `{ "rev": <new rev> }`. Allowed when the caller is `host_id`, or when the host
hasn't synced for 10 seconds (then `host_id` becomes the caller). Otherwise `wkd_not_host`. The document
must be an object of at most 256 KB (`wkd_bad_doc`). Locks the party row; `rev = rev + 1`,
`updated_at = now()`. When the document's `state.phase` changes to `over` with a `state.round.winner`,
also insert the `wkd_party_results` row for `(party_id, state.round.n)` with the winner's user id (the
winning unit's first member, `state.round.units[winner].members[0]`, if it is a member of the party;
null for teams) and the number of units, once (ignore conflicts).

### `wkd_party_leave(party_id uuid) returns void`
Removes the caller's membership. A party with no members is deleted by the cleanup.

### `wkd_party_invite(party_id uuid, friend_id uuid) returns json`
The caller (a member) invites an accepted friend (`br_friendships`): `{ "status": "sent" }`. Errors:
`wkd_no_such_party`, `wkd_not_friends`, `wkd_rate_limited` (more than 20 invites a minute).

### `wkd_party_invites() returns json`
Invites to the caller from the last 30 minutes, for parties still alive, newest first:
`[ { "party_id": "uuid", "code": "KQ3RT", "from": "Atlas_Reads", "from_member": true, "created_at": "…" } ]`.

### `wkd_party_decline(party_id uuid) returns void`
Deletes the caller's invite to that party.

## Cleanup

A scheduled job (or the create function, opportunistically) deletes parties not updated for 6 hours
(cascading members and invites) and invites older than 30 minutes. `wkd_party_results` rows stay
(`on delete set null` on `party_id`), so friends' party wins survive.

## Checklist

1. The four tables (RLS on, no grants) and the eight functions with exact names, parameters, JSON keys
   and error codes; only members can sync or read a party.
2. Host takeover only after 10 s without the host's sync; the result row written once per round.
3. Tests: create/join/full/too many; sync returns `doc` only past `since_rev`; presence size limit; put by
   the host, refused for others, allowed after the host's 10 s silence (and `host_id` moves); invites only
   to friends, listed and declined; results rows for race wins; a non-member can't see or touch a party.
4. Deploy to the Warden Chat project once SirSC says so.
