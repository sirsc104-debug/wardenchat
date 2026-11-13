# Brain Rocket – Evolved on the SirSC wallet: the back-end contract

Brain Rocket – Evolved uses the SirSC wallet that Downhill Death Run and Wildcard Chess already use:
the same Warden Chat accounts, the same `sirsc_wallets` / `sirsc_ledger` / `sirsc_catalog` /
`sirsc_owned` tables, and the same `sirsc_me`, `sirsc_member_claim`, `sirsc_buy`, `sirsc_equip`,
`sirsc_request_diamonds` and `sirsc_cancel_request` functions, called with `game = 'bre'`. That
contract is `docs/ECONOMY-API.md` in `sirsc104-debug/claude`; everything there applies unchanged.
This file is only what this game adds: two functions, a private table and the `bre` catalog rows.

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

## `bre_reward(mode text, diff text, day integer, score integer, prompts integer, answers integer, duration_ms integer) returns json`

The game calls this once when a **Daily Launch** or an **Endless** run ends. Archive launches, runs
that end in a crash (a rude word) and Dailies left part-way never call it.

**member_mult** is 1.5 for members, else 1, in both modes.

### `mode = 'daily'`

`diff` is `''`. `day` is the launch number: launch #1 is November 13, 2026, and a day is the player's
own calendar day, so accept `day` within 1 of the UTC launch number
(`floor((now() at time zone 'utc')::date - date '2026-11-13') + 1`).

**coins = floor((10,000 + floor(0.6 × score)) × member_mult)**: 10,000 for finishing, up to 40,000 for a
perfect 50,000 (60,000 for members).

- **Paid once per player per `day`.** Record it in `warden_private.bre_daily_paid (user_id, day,
  coins, created_at, primary key (user_id, day))`. A second call for the same day pays 0 and returns
  `already_paid: true` (no error).
- **Plausibility** → else `sirsc_bad_reward`: `prompts` = 10; `answers` 0 to 10; `score` from
  `answers × 500` to `answers × 5,000` and a multiple of 250 (every tier is a multiple of 250);
  `duration_ms` 10,000 to 10,800,000 (3 hours).
- Not part of the Endless daily cap, but it counts toward the wallet-wide 300,000-a-day cap of
  ECONOMY-API.md.

Returns:

```jsonc
{ "coins": 28000, "base": 10000, "score_bonus": 18000, "member_mult": 1, "already_paid": false,
  "me": <sirsc_me('bre')> }
```

Examples: 30,000 points: 10,000 + 18,000 = 28,000. 50,000 as a member: 40,000 × 1.5 = 60,000.
Ten misses (0 points): 10,000.

### `mode = 'endless'`

`diff` is `easy`, `medium`, `hard` or `ultra` (anything else → `sirsc_bad_reward`); `day` is ignored.
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

## The catalog to seed (game `bre`)

Priced like the other games: 1 💎 = 5,000 coins, and coin prices are 75% of that. Every item has
`target = ''`. The slot is the part before the colon (`rocket`, `flame`, `trail`), for `sirsc_equip`.

| item_id | coins | 💎 | notes |
|---|---|---|---|
| rocket:midnight | 15,000 | 4 |  |
| rocket:sunset | 15,000 | 4 |  |
| rocket:mint | 15,000 | 4 |  |
| rocket:retro | 22,500 | 6 |  |
| rocket:gold | 30,000 | 8 |  |
| rocket:chrome | – | 12 | diamonds only |
| rocket:galaxy | – | 15 | diamonds only |
| rocket:diamond | – | – | member_only, no claim window: every member can claim it while a member |
| rocket:royal | – | – | member_only, claim 2026-11-01T00:00Z to 2026-12-01T00:00Z (November 2026's members' rocket) |
| flame:plasma | 7,500 | 2 |  |
| flame:toxic | 7,500 | 2 |  |
| flame:candy | 15,000 | 4 |  |
| flame:inferno | 22,500 | 6 |  |
| flame:rainbow | – | 10 | diamonds only |
| flame:diamond | – | – | member_only, no claim window |
| trail:stardust | 7,500 | 2 |  |
| trail:hearts | 15,000 | 4 |  |
| trail:notes | 15,000 | 4 |  |
| trail:bubbles | 15,000 | 4 |  |
| trail:coins | – | 12 | diamonds only |
| trail:shards | – | – | member_only, no claim window |

`sirsc_member_claim('bre')` gives the member-only rows exactly as it does for `ddr` and `wcc` (window
items inside their window, no-window items while a member), with `target = ''`. Each month's new
members' rocket is one more `rocket:<id>` row with that month's window.

The free defaults (`rocket:classic`, `flame:classic`, `trail:classic`) are not catalog rows: everyone
has them.

## Checklist

1. One migration: `warden_private.bre_daily_paid`, whatever private table the hourly limit and the
   Endless daily cap need (or reuse the economy's reward log with `game = 'bre'`), the `bre` catalog
   rows, `bre_ping`, `bre_reward`. Exact names, parameters, JSON keys and error codes.
2. `bre_reward` locks the wallet row, pays a Daily at most once per day, and writes the ledger row in
   the same transaction.
3. Tests (as for the economy, no Docker): both formulas with and without membership, the Daily once
   per day (second call pays 0 with `already_paid`), the day window (±1), the Endless 80,000 cap (cut,
   then 0), the 300,000 wallet-wide cap still applying, every plausibility error, the hourly limit, and
   `sirsc_buy` / `sirsc_equip` / `sirsc_member_claim` working with `game = 'bre'`.
4. Deploy to the Warden Chat project once SirSC says so.
