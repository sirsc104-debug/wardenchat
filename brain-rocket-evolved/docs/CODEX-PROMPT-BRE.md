Build the back end that lets Brain Rocket – Evolved pay out and spend SirSC coins and diamonds, and
keep its Daily Launch leaderboard. It is
a small addition to the SirSC wallet you already built for Downhill Death Run and Wildcard Chess
(docs/ECONOMY-API.md in sirsc104-debug/claude, and projects/wildcard-chess/docs/ECONOMY-WCC.md in
sirsc104-debug/wardenchat on the claude/wcc-stay-equipped branch): the same tables and sirsc_*
functions, with game = 'bre'.

The full contract is pasted below this prompt, between the two ===== lines (it is also
brain-rocket-evolved/docs/ECONOMY-BRE.md in sirsc104-debug/wardenchat, branch claude/sweet-keller-8smja3).
Follow it exactly: the front end is already built against it.

What to do, in sirsc104-debug/warden-chat:
1. bre_ping() (anon and authenticated) and bre_reward(mode, diff, day, score, prompts, answers,
   duration_ms, tiers) with the exact formulas, plausibility checks, limits, JSON keys and error codes.
2. bre_daily_board(day, scope) (anon and authenticated): the Daily Launch leaderboard, everyone or
   friends (Brain Rocket's br_friendships), ranks, the caller's own row, no answers.
3. warden_private.bre_daily_scores, and whatever the hourly limit and the Endless daily cap need (or
   reuse the economy's reward log with game = 'bre').
4. Seed the bre catalog rows from the table.
5. Every balance change locks the wallet row, never goes below zero, and writes a ledger row in the same
   transaction.
6. Tests as listed in the checklist. Don't deploy until SirSC says so.

=====
# Brain Rocket – Evolved on the SirSC wallet: the back-end contract

Brain Rocket – Evolved uses the SirSC wallet that Downhill Death Run and Wildcard Chess already use:
the same Warden Chat accounts, the same `sirsc_wallets` / `sirsc_ledger` / `sirsc_catalog` /
`sirsc_owned` tables, and the same `sirsc_me`, `sirsc_member_claim`, `sirsc_buy`, `sirsc_equip`,
`sirsc_request_diamonds` and `sirsc_cancel_request` functions, called with `game = 'bre'`. That
contract is `docs/ECONOMY-API.md` in `sirsc104-debug/claude`; everything there applies unchanged.
This file is only what this game adds: three functions (`bre_ping`, `bre_reward` and the Daily
Launch leaderboard, `bre_daily_board`), a private table and the `bre` catalog rows.

Conventions as in ECONOMY-API.md and Wildcard Chess's `docs/ECONOMY-WCC.md`: one new migration in
`sirsc104-debug/warden-chat` on top of the SirSC economy migration; RLS on, no table grants to
`anon`/`authenticated`; `SECURITY DEFINER` functions with `set search_path = public, pg_temp`; the
session check `warden_private.game_session_valid()` (refuse as `sirsc_not_signed_in`); errors raised as
`raise exception '<code>' using errcode = 'P0001'`; grants to `authenticated` only (and `bre_ping` to
`anon` too).

The front end is `brain-rocket-evolved/js/wallet.js` and `js/shop.js` in `sirsc104-debug/wardenchat`,
built against this contract and a pretend back end that follows it (`js/wallet-mock.js`, in
`tools/build_page.py --wallet-demo` builds only).

## `bre_ping() returns boolean`

Returns `true`. Callable anonymously. The game calls it on load: until it answers, accounts stay
hidden and the game works exactly as it does without them.

## `bre_reward(mode text, diff text, day integer, score integer, prompts integer, answers integer, duration_ms integer, tiers integer[]) returns json`

The game calls this once when a **Daily Launch** or an **Endless** run ends. Archive launches, runs
that end in a crash (a rude word) and Dailies left part-way never call it.

**member_mult** is 1.5 for members, else 1, in both modes.

### `mode = 'daily'`

`diff` is `''`. `day` is the launch number: launch #1 is November 13, 2026, and a day is the player's
own calendar day, so accept `day` within 1 of the UTC launch number
(`floor((now() at time zone 'utc')::date - date '2026-11-13') + 1`).

**coins = floor((10,000 + floor(0.6 × score)) × member_mult)**: 10,000 for finishing, up to 40,000 for a
perfect 50,000 (60,000 for members).

- `tiers` is the launch's 10 results in order: the tier of each answer (0 Launch Pad, 1 Space Junk,
  2 Orbiter, 3 Moonshot, 4 Deep Space, 5 Supernova) or -1 for a miss. The leaderboard shows them.
- **Paid once per player per `day`, and that first launch is the one on the leaderboard.** Record it
  in `warden_private.bre_daily_scores (user_id, day, score, tiers smallint[], answers, coins,
  finished_at timestamptz default now(), primary key (user_id, day))`. A second call for the same day
  pays 0, changes nothing on the board and returns `already_paid: true` (no error).
- **Plausibility** → else `sirsc_bad_reward`: `prompts` = 10; `tiers` has exactly 10 integers from -1
  to 5; `answers` = how many of them are 0 or more; **`score` = the sum of the tiers' points**
  (500, 750, 1,500, 3,000, 4,250, 5,000; a miss is 0); `duration_ms` 10,000 to 10,800,000 (3 hours).
- Not part of the Endless daily cap, but it counts toward the wallet-wide 300,000-a-day cap of
  ECONOMY-API.md.

Returns:

```jsonc
{ "coins": 28000, "base": 10000, "score_bonus": 18000, "member_mult": 1, "already_paid": false,
  "rank": 12, "players": 340, "me": <sirsc_me('bre')> }
```

`rank` and `players` are the player's place on that day's board (as `bre_daily_board` counts it) and
how many players are on it.

Examples: 30,000 points: 10,000 + 18,000 = 28,000. 50,000 as a member: 40,000 × 1.5 = 60,000.
Ten misses (0 points): 10,000.

### `mode = 'endless'`

`diff` is `easy`, `medium`, `hard` or `ultra` (anything else → `sirsc_bad_reward`); `day` and `tiers`
are ignored (`tiers` is null). Endless runs are not on the leaderboard.
Endless scores use Brain Rocket's classic points (10 to 200 an answer, times up to ×2.5 for the
difficulty, ×2 for speed, ×5 for a streak and ×1.5 for a Supernova), and on Ultra Hard the score is
the highest point reached.

**coins = floor(min(20,000, floor(0.4 × score)) × member_mult)**: a 50,000-point run pays the most a run
can, 20,000 (30,000 for members).

- **Daily cap: 80,000 coins a day (UTC) per player from Endless.** A reward that would pass it is cut
  to what's left (`capped: true`, possibly 0). `today` is what the player has earned from Endless
  today after this run, `daily_cap` is 80,000. These coins also count toward the wallet-wide 300,000.
- **Plausibility** → else `sirsc_bad_reward`: `prompts` 1 to 2,000; `answers` 0 to `prompts`; `score`
  0 to `answers × 7,500` (the most one answer can score); `duration_ms` at least `prompts × 1,500` and
  at most 14,400,000 (4 hours).
- **At most 20 rewarded runs an hour** per player → `sirsc_rate_limited`.

Returns:

```jsonc
{ "coins": 2340, "score_coins": 1560, "member_mult": 1.5, "capped": false, "today": 2340,
  "daily_cap": 80000, "me": <sirsc_me('bre')> }
```

Both modes write one ledger row (`reward`, game `bre`, coins = what was paid, note like
`daily #3 30000` or `endless hard 12400`), lock the wallet row, and never take the balance below zero.

## `bre_daily_board(day integer, scope text) returns json`

The Daily Launch leaderboard for one day. Callable **anonymously** (anyone can look) and by
`authenticated`. It never returns answers, only tiers, so nothing is given away before midnight.

- `day`: a launch number from 1 to the UTC launch number + 1 → else `sirsc_bad_request`.
- `scope`: `'all'` (everyone) or `'friends'`: the caller and their accepted friends from Brain
  Rocket's `public.br_friendships` (pairs stored once, `user_a < user_b`). `'friends'` needs a
  sign-in → `sirsc_not_signed_in`. Anything else → `sirsc_bad_request`.
- Rows come from `warden_private.bre_daily_scores` for that day, joined to `public.profiles` for the
  username. Leave out accounts that aren't active on Warden Chat (banned or suspended,
  `warden_private.account_is_active()`).
- **Order**: score, highest first; ties in the order they finished (`finished_at`, earliest first).
- **Rank**: 1 + the number of players in the scope with a higher score, so ties share a rank
  (1, 2, 2, 4).
- `rows` is the top 50 of the scope. `me` is the caller's own row (even when it isn't in the top 50),
  or null when signed out or not on the board. `players` is how many are in the scope.
- `member` is true when that player is a SirSC Member right now (the badge by their name).

```jsonc
{ "day": 2, "scope": "all", "players": 340,
  "me": { "rank": 12, "username": "MomSaab", "member": false, "score": 31250,
          "tiers": [3, 2, 4, -1, 0, 3, 5, 2, 1, 4], "you": true },
  "rows": [ { "rank": 1, "username": "luna", "member": true, "score": 42500,
              "tiers": [4, 4, 3, 5, 4, 2, 4, 3, 4, 4], "you": false }, … ] }
```

## The catalog to seed (game `bre`)

Priced like the other games: 1 💎 = 5,000 coins, and coin prices are 75% of that. Every item has
`target = ''`. The slot is the part before the colon (`rocket`, `flame`, `trail`, `scene`), for
`sirsc_equip`. Scenes are the launch site and its sky.

| item_id | coins | 💎 | notes |
|---|---|---|---|
| rocket:midnight | 15,000 | 4 |  |
| rocket:sunset | 15,000 | 4 |  |
| rocket:mint | 15,000 | 4 |  |
| rocket:retro | 22,500 | 6 |  |
| rocket:shark | 22,500 | 6 |  |
| rocket:gold | 30,000 | 8 |  |
| rocket:lava | – | 10 | diamonds only |
| rocket:chrome | – | 12 | diamonds only |
| rocket:galaxy | – | 15 | diamonds only |
| rocket:hologram | – | 18 | diamonds only |
| rocket:diamond | – | – | member_only, no claim window: every member can claim it while a member |
| rocket:royal | – | – | member_only, claim 2026-11-01T00:00Z to 2026-12-01T00:00Z (that month's members' item) |
| flame:plasma | 7,500 | 2 |  |
| flame:toxic | 7,500 | 2 |  |
| flame:candy | 15,000 | 4 |  |
| flame:inferno | 22,500 | 6 |  |
| flame:rainbow | – | 10 | diamonds only |
| flame:ghost | – | 12 | diamonds only |
| flame:lightning | – | 15 | diamonds only |
| flame:diamond | – | – | member_only, no claim window: every member can claim it while a member |
| trail:stardust | 7,500 | 2 |  |
| trail:hearts | 15,000 | 4 |  |
| trail:notes | 15,000 | 4 |  |
| trail:bubbles | 15,000 | 4 |  |
| trail:pixels | 15,000 | 4 |  |
| trail:ribbon | – | 10 | diamonds only |
| trail:coins | – | 12 | diamonds only |
| trail:fireworks | – | 14 | diamonds only |
| trail:shards | – | – | member_only, no claim window: every member can claim it while a member |
| scene:arctic | 30,000 | 8 |  |
| scene:desert | 30,000 | 8 |  |
| scene:ocean | 37,500 | 10 |  |
| scene:candy | 37,500 | 10 |  |
| scene:city | 45,000 | 12 |  |
| scene:moonbase | – | 20 | diamonds only |
| scene:crystal | – | – | member_only, no claim window: every member can claim it while a member |

`sirsc_member_claim('bre')` gives the member-only rows exactly as it does for `ddr` and `wcc` (window
items inside their window, no-window items while a member), with `target = ''`. Each month's new
members' item is one more row (a rocket, flame, trail or scene) with that month's window.

The free defaults (`rocket:classic`, `flame:classic`, `trail:classic`, `scene:dusk`) are not catalog
rows: everyone has them.

## Checklist

1. One migration: `warden_private.bre_daily_scores` (indexed on `(day, score desc, finished_at)`),
   whatever private table the hourly limit and the Endless daily cap need (or reuse the economy's
   reward log with `game = 'bre'`), the `bre` catalog rows, `bre_ping`, `bre_reward`,
   `bre_daily_board`. Exact names, parameters, JSON keys and error codes.
2. `bre_reward` locks the wallet row, pays a Daily at most once per day, and writes the ledger row in
   the same transaction.
3. Tests (as for the economy, no Docker): both formulas with and without membership, the Daily once
   per day (second call pays 0 with `already_paid`), the day window (±1), the Endless 80,000 cap (cut,
   then 0), the 300,000 wallet-wide cap still applying, every plausibility error (a score that doesn't
   add up from the tiers), the hourly limit, the board (order, shared ranks, `me` outside the top 50,
   the friends scope, anonymous reads, banned players left out, no answers anywhere), and
   `sirsc_buy` / `sirsc_equip` / `sirsc_member_claim` working with `game = 'bre'`.
4. Deploy to the Warden Chat project once SirSC says so.
=====
