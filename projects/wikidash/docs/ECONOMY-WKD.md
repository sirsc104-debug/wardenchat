# WikiDash on the SirSC wallet: the back-end contract

WikiDash uses the SirSC wallet that Downhill Death Run and Wildcard Chess already use: the same Warden
Chat accounts, the same `sirsc_wallets` / `sirsc_ledger` / `sirsc_catalog` / `sirsc_owned` tables, and
the same `sirsc_me`, `sirsc_member_claim`, `sirsc_buy`, `sirsc_request_diamonds` and
`sirsc_cancel_request` functions, called with `game = 'wkd'`. That contract is `docs/ECONOMY-API.md` in
`sirsc104-debug/claude`; everything there applies unchanged. This file is only what WikiDash adds: one
function (`wkd_reward`), the reward log it needs, and the `wkd` catalog rows. `wkd_ping` is in
[ACCOUNTS-WKD.md](ACCOUNTS-WKD.md).

Conventions as in ECONOMY-API.md and [ECONOMY-WCC.md](../../wildcard-chess/docs/ECONOMY-WCC.md): one new
migration in `sirsc104-debug/warden-chat` on top of the SirSC economy migration; RLS on, no table grants
to `anon`/`authenticated`; `SECURITY DEFINER` functions with `set search_path = public, pg_temp`; the
session check `warden_private.game_session_valid()` (refuse as `sirsc_not_signed_in`); errors raised as
`raise exception '<code>' using errcode = 'P0001'`; grants to `authenticated` only.

The front end is `projects/wikidash/src/wc/wallet.js` and `src/reward.js` in `sirsc104-debug/wardenchat`,
built against this contract and a pretend back end that follows it (`src/wc/mock.js`, demo builds only).

## `wkd_reward(kind text, level text, clicks integer, par integer, duration_ms integer, start text, target text, date text) returns json`

The game calls this once when the player **wins a solo race or a daily challenge** (reaches the target).
Party races never call it: two friends could trade wins. Gave-up, timed-out and disqualified runs never
call it either. Returns:

```jsonc
{ "coins": 1350, "base": 600, "eff_mult": 1.5, "perfect": true, "member_mult": 1.5,
  "first_daily_bonus": 0, "capped": false, "today": 1350, "daily_cap": 20000, "me": <sirsc_me('wkd')> }
```

**coins = floor(base × eff_mult × member_mult) + first_daily_bonus**, then the daily cap.

- `kind`: `solo` or `daily`. Anything else → `sirsc_bad_reward`.
- `level`: `easy`, `medium` or `hard` → **base**: solo 300 / 600 / 1,200; daily 800 / 1,200 / 2,000.
  Anything else → `sirsc_bad_reward`. (The browser sends the level that the route's par means: par 2 is
  easy, 3 medium, 4 or more hard; for a daily, that day's level.)
- `par` is the route's shortest length in clicks (the game knows the link graph); `clicks` is how many
  the player used. **eff_mult**: 1.5 when `clicks = par` (`perfect: true`), otherwise
  `max(0.4, round(par / clicks, 2))`.
- **member_mult** 1.5 for members, else 1.
- **first_daily_bonus** 1,000 on the player's first `daily` reward for that `date` (the US Eastern date
  the daily belongs to, `YYYY-MM-DD`), else 0.
- **Plausibility and limits**: `par` 1 to 12; `clicks` at least `par` and at most 200; `duration_ms` at
  least 1,000 × `clicks` and at most 10,800,000 (3 hours); `start` and `target` non-empty and at most 255
  characters; `date` a valid date within a day of today (Eastern) when `kind = 'daily'` → else
  `sirsc_bad_reward`. At most 40 rewarded runs an hour per player → `sirsc_rate_limited`.
- **Daily cap: 20,000 coins a day (UTC) per player from `wkd_reward`**, the daily bonus included. A
  reward that would pass it is cut to what's left (`capped: true`, possibly 0). `today` is what the
  player has earned from WikiDash today after this run, `daily_cap` is 20,000. These coins also count
  toward the wallet-wide 300,000-a-day cap of ECONOMY-API.md, whichever is hit first.
- Writes one ledger row (`reward`, game `wkd`, coins = the total paid, note like `solo medium 3/3` or
  `daily hard 6/5 +first`).
- Also records the run in `warden_private.wkd_runs (user_id, kind, level, clicks, par, duration_ms,
  date, coins, created_at)`, which `wkd_friends` reads for friends' daily results and solo wins
  ([ACCOUNTS-WKD.md](ACCOUNTS-WKD.md)), and which the hourly limit, daily cap and daily bonus use.

The server can't check that the player really reached the target in that many clicks (it doesn't know
the link graph); the caps, the hourly limit and the plausibility rules bound what a forged call can earn,
as for every SirSC game.

Examples: a perfect Medium solo run: 600 × 1.5 = 900 (1,350 for a member). Hard in 6 clicks with par 4:
1,200 × 0.67 = 804. Today's Easy daily in 3 with par 2, first finish of the day: 800 × 0.67 + 1,000 = 1,536.

## The catalog to seed (game `wkd`)

Priced like Downhill Death Run and Wildcard Chess: 1 💎 = 5,000 coins, and coin prices are 75% of that.
Every item has `target = ''`. 22 items for coins or diamonds, 8 for diamonds only, 4 for members only.

| item_id | coins | 💎 | notes |
|---|---|---|---|
| paper:newsprint | 15,000 | 4 | pages restyle the article while you race |
| paper:parchment | 15,000 | 4 | |
| paper:blueprint | 22,500 | 6 | |
| paper:midnight | 22,500 | 6 | |
| paper:botanical | 22,500 | 6 | |
| paper:galactica | – | 12 | diamonds only |
| paper:gilded | – | 15 | diamonds only |
| paper:royal | – | – | member_only, claim 2026-11-01T00:00Z to 2026-12-01T00:00Z (November 2026's members' page) |
| links:highlighter | 7,500 | 2 | link styles change how clickable links look |
| links:redpen | 7,500 | 2 | |
| links:mint | 7,500 | 2 | |
| links:neon | 15,000 | 4 | |
| links:rainbow | – | 10 | diamonds only |
| links:diamond | – | – | member_only, no claim window: every member can claim it while a member |
| avatar:owl | 7,500 | 2 | avatars show by your name, to everyone in your party |
| avatar:fox | 7,500 | 2 | |
| avatar:octopus | 15,000 | 4 | |
| avatar:rocket | 15,000 | 4 | |
| avatar:wizard | 30,000 | 8 | |
| avatar:dragon | – | 10 | diamonds only |
| avatar:unicorn | – | 12 | diamonds only |
| avatar:crown | – | – | member_only, no claim window |
| finale:inkburst | 22,500 | 6 | finishes play when you reach the target |
| finale:paperplanes | 22,500 | 6 | |
| finale:fireworks | 30,000 | 8 | |
| finale:stars | 30,000 | 8 | |
| finale:supernova | – | 20 | diamonds only |
| finale:diamond | – | – | member_only, no claim window |
| spark:ink | 7,500 | 2 | click effects burst out of a link when you click it |
| spark:confetti | 7,500 | 2 | |
| spark:stars | 15,000 | 4 | |
| spark:bubbles | 15,000 | 4 | |
| spark:lightning | – | 10 | diamonds only |
| spark:goldleaf | – | 12 | diamonds only |

`sirsc_member_claim('wkd')` gives the member-only rows exactly as it does for `ddr` and `wcc` (window items
inside their window, yours forever; no-window items while a member), with `target = ''`. Each month's new
members' content is one more `paper:<id>` row with that month's window.

The free defaults (`paper:classic`, `links:classic`, `avatar:reader`, `finale:confetti`, `spark:ring`)
are not catalog rows: everyone has them.

## Checklist

1. One migration: `warden_private.wkd_runs`, the `wkd` catalog rows, `wkd_reward` (and `wkd_ping` plus
   the friends functions from ACCOUNTS-WKD.md and the party functions from PARTIES-WKD.md, if they go in
   the same migration). Exact names, parameters, JSON keys and error codes.
2. `wkd_reward` locks the wallet row and writes the ledger row and the `wkd_runs` row in the same
   transaction.
3. Tests (as for the economy, no Docker): the formula for every kind and level, perfect and imperfect
   runs (the 0.4 floor), the member multiplier, the daily bonus once per date, the 20,000 cap (cut, then
   0), the 300,000 wallet-wide cap still applying, every plausibility error, the hourly limit, and
   `sirsc_buy` / `sirsc_member_claim` working with `game = 'wkd'`.
4. Deploy to the Warden Chat project once SirSC says so.
