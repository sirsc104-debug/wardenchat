# Wildcard Chess on the SirSC wallet: the back-end contract

Wildcard Chess uses the SirSC wallet that Downhill Death Run already uses: the same Warden Chat
accounts, the same `sirsc_wallets` / `sirsc_ledger` / `sirsc_catalog` / `sirsc_owned` tables, and the
same `sirsc_me`, `sirsc_member_claim`, `sirsc_buy`, `sirsc_request_diamonds` and `sirsc_cancel_request`
functions, called with `game = 'wcc'`. That contract is `docs/ECONOMY-API.md` in
`sirsc104-debug/claude`; everything there applies unchanged. This file is only what Wildcard Chess
adds: two functions, one private table and the `wcc` catalog rows.

Conventions as in ECONOMY-API.md: one new migration in `sirsc104-debug/warden-chat` on top of the
SirSC economy migration; RLS on, no table grants to `anon`/`authenticated`; `SECURITY DEFINER`
functions with `set search_path = public, pg_temp`; the session check
`warden_private.game_session_valid()` (refuse as `sirsc_not_signed_in`); errors raised as
`raise exception '<code>' using errcode = 'P0001'`; grants to `authenticated` only (and `wcc_ping` to
`anon` too).

The front end is `projects/wildcard-chess/js/wallet.js` in `sirsc104-debug/wardenchat`, built against
this contract and a pretend back end that follows it (`js/wallet-mock.js`).

## `wcc_ping() returns boolean`

Returns `true`. Callable anonymously. The game calls it on load: until it answers, accounts stay
hidden and the game works exactly as it does today.

## `wcc_reward(level text, result text, plies integer, duration_ms integer, draft boolean, codex text[]) returns json`

The game calls this once when a game **against the computer** ends (Pass & Play games never call it:
one signed-in account playing both sides could farm coins). Returns:

```jsonc
{ "coins": 5250, "base": 2000, "result_mult": 1, "draft_mult": 1.25, "member_mult": 1.5,
  "first_win_bonus": 1500, "codex_bonus": 0, "codex_new": [], "capped": false,
  "today": 9750, "daily_cap": 25000, "me": <sirsc_me('wcc')> }
```

**coins = floor(base × result_mult × draft_mult × member_mult) + first_win_bonus**, then the daily cap,
then **+ codex_bonus** (outside the cap).

- `level`: **base** `easy` 500, `medium` 1,000, `pro` 2,000, `xtreme` 4,000. Anything else →
  `sirsc_bad_reward`.
- `result`: **result_mult** `win` 1, `draw` 0.3, `loss` 0.1 (a resignation is a loss). Anything else →
  `sirsc_bad_reward`.
- **draft_mult** 1.25 when `draft` is true (the army was drafted), else 1.
- **member_mult** 1.5 for members, else 1.
- **first_win_bonus** 1,500 on the player's first `win` of the UTC day in Wildcard Chess, else 0.
- **Plausibility and limits**: `plies` at least 12 and at most 1,000; `duration_ms` at least 30,000
  and at most 14,400,000 (4 hours) → else `sirsc_bad_reward`. At most 20 rewarded games an hour per
  player → `sirsc_rate_limited`.
- **Daily cap: 25,000 coins a day (UTC) per player from `wcc_reward`**, first-win bonus included. A
  reward that would pass it is cut to what's left (`capped: true`, possibly 0). `today` is what the
  player has earned from Wildcard Chess today after this game, `daily_cap` is 25,000. These coins also
  count toward the wallet-wide 300,000-a-day cap of ECONOMY-API.md, whichever is hit first.
- **Codex bonus (lifetime, outside the daily cap)**: `codex` lists the wildcard ids that were in this
  game (both sides). For each valid id (the list below) the player has never been paid for, add 500
  coins and record it in `warden_private.wcc_codex_paid (user_id, wildcard, created_at, primary key
  (user_id, wildcard))`. `codex_new` lists them; `codex_bonus` = 500 × their count. Unknown ids are
  ignored (no error). At most 55 × 500 = 27,500 coins per player ever. Pay it even when `capped`.
- Writes one ledger row (`reward`, game `wcc`, coins = the total paid, note like
  `pro win draft` / `+codex 2`).

Examples: beat Pro: 2,000. Beat Xtreme in a draft as a member: 4,000 × 1.25 × 1.5 = 7,500 (+1,500
if it's the first win today). Lose to Medium: 100. Draw against Easy: 150.

Valid wildcard ids: bomber, phantom, blink, trickster, archer, necro, frost, wyvern, hopper, serpent,
ricochet, orbit, juggernaut, cannon, tempest, mimic, siren, guardian, golem, phoenix, viper, brood,
chrono, mason, vampire, marauder, hexer, catapult, assassin, void, magnet, rampage, comet, kangaroo,
tesla, drummer, sniper, amoeba, changeling, monk, alchemist, displacer, oracle, zombie, chameleon,
warlord, cyclops, gorgon, grappler, echo, and the five legendary ones: dragon, archangel, timelord,
blackhole, zeus.

## The catalog to seed (game `wcc`)

Priced like Downhill Death Run: 1 💎 = 5,000 coins, and coin prices are 75% of that. Every item has
`target = ''`.

| item_id | coins | 💎 | notes |
|---|---|---|---|
| board:marble | 15,000 | 4 | |
| board:ebony | 15,000 | 4 | |
| board:emerald | 22,500 | 6 | |
| board:ice | 22,500 | 6 | |
| board:neon | – | 12 | diamonds only |
| board:haunted | – | 15 | diamonds only |
| board:royal | – | – | member_only, claim 2026-11-01T00:00Z to 2026-12-01T00:00Z (November 2026's members' board) |
| back:crimson | 7,500 | 2 | |
| back:midnight | 7,500 | 2 | |
| back:jade | 7,500 | 2 | |
| back:gold | 15,000 | 4 | |
| back:diamond | – | – | member_only, no claim window: every member can claim it while a member |
| finale:fireworks | 30,000 | 8 | |
| finale:inferno | 30,000 | 8 | |
| finale:frost | 30,000 | 8 | |
| finale:supernova | – | 20 | diamonds only |
| pieces:marble | 22,500 | 6 | piece sets restyle every piece |
| pieces:carved | 22,500 | 6 | |
| pieces:gilded | 30,000 | 8 | |
| pieces:glass | – | 12 | diamonds only |
| pieces:neon | – | 15 | diamonds only |
| pieces:royal | – | – | member_only, claim 2026-11-01T00:00Z to 2026-12-01T00:00Z (November 2026's members' piece set) |
| capture:confetti | 15,000 | 4 | capture effects play when your pieces capture |
| capture:petals | 15,000 | 4 | |
| capture:pixel | 22,500 | 6 | |
| capture:shadow | 22,500 | 6 | |
| capture:lightning | – | 10 | diamonds only |
| capture:goldrush | – | 15 | diamonds only |
| capture:diamond | – | – | member_only, no claim window: every member can claim it while a member |
| avatar:knight | 7,500 | 2 | avatars show in the player bar, and to the opponent online |
| avatar:bomber | 7,500 | 2 | |
| avatar:phantom | 15,000 | 4 | |
| avatar:vampire | 15,000 | 4 | |
| avatar:archangel | 30,000 | 8 | |
| avatar:dragon | – | 10 | diamonds only |
| avatar:zeus | – | 12 | diamonds only |
| avatar:crown | – | – | member_only, no claim window: every member can claim it while a member |

`sirsc_member_claim('wcc')` gives the member-only rows exactly as it does for `ddr` (window items
inside their window, no-window items while a member), with `target = ''`. Each month's new members'
content is one more `board:<id>` row and one more `pieces:<id>` row with that month's window.

The free defaults (`board:walnut`, `pieces:classic`, `back:classic`, `capture:splinters`,
`finale:classic`, `avatar:king`) are not catalog rows: everyone has them.

## Checklist

1. One migration: `warden_private.wcc_codex_paid` and whatever private table the hourly limit, daily
   cap and first-win bonus need (or reuse the economy's reward log with `game = 'wcc'`), the
   `wcc` catalog rows, `wcc_ping`, `wcc_reward`. Exact names, parameters, JSON keys and error codes.
2. `wcc_reward` locks the wallet row, never pays twice for the same codex id, and writes the ledger row
   in the same transaction.
3. Tests (as for the economy, no Docker): the formula for every level and result, draft and member
   multipliers, the first-win bonus once per UTC day, the 25,000 cap (cut, then 0), the 300,000
   wallet-wide cap still applying, the codex bonus once per id and outside the cap, unknown codex ids
   ignored, plausibility errors, the hourly limit, and `sirsc_buy` / `sirsc_member_claim` working
   with `game = 'wcc'`.
4. Deploy to the Warden Chat project once SirSC says so.
