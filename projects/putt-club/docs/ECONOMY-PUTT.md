# Putt Club on the SirSC wallet: the back-end contract

Putt Club uses the SirSC wallet that Downhill Death Run and Wildcard Chess already use: the same Warden
Chat accounts, the same `sirsc_wallets` / `sirsc_ledger` / `sirsc_catalog` / `sirsc_owned` tables, and
the same `sirsc_me`, `sirsc_member_claim`, `sirsc_buy`, `sirsc_request_diamonds` and
`sirsc_cancel_request` functions, called with `game = 'putt'`. That contract is `docs/ECONOMY-API.md` in
`sirsc104-debug/claude`; everything there applies unchanged. This file is only what Putt Club adds: two
functions and the `putt` catalog rows. Online rooms are a separate contract (`ONLINE-PUTT.md`).

Conventions as in ECONOMY-API.md: one new migration in `sirsc104-debug/warden-chat` on top of the
SirSC economy migration (and the Wildcard Chess one, if it is there); RLS on, no table grants to
`anon`/`authenticated`; `SECURITY DEFINER` functions with `set search_path = public, pg_temp`; the
session check `warden_private.game_session_valid()` (refuse as `sirsc_not_signed_in`); errors raised as
`raise exception '<code>' using errcode = 'P0001'`; grants to `authenticated` only (and `putt_ping` to
`anon` too).

The front end is `projects/putt-club/js/wallet.js` in `sirsc104-debug/wardenchat`, built against this
contract and a pretend back end that follows it (`js/wallet-mock.js`, demo builds only).

## `putt_ping() returns boolean`

Returns `true`. Callable anonymously. The game calls it on load: until it answers, accounts stay hidden
and the game works exactly as it does today (the Shop can be browsed and previewed, but not bought from).

## `putt_reward(diff text, holes integer, strokes integer, par integer, place integer, aces integer, duration_ms integer) returns json`

The game calls this once when a round **against the rivals** ends (never for Training holes, never for
online rounds: friends could farm coins for each other). Returns:

```jsonc
{ "coins": 4950, "base": 1500, "holes_mult": 2, "place_mult": 1, "member_mult": 1.5,
  "under_par_bonus": 450, "ace_bonus": 0, "first_win_bonus": 0, "capped": false,
  "today": 9950, "daily_cap": 25000, "me": <sirsc_me('putt')> }
```

**coins = floor(base × holes_mult × place_mult × member_mult) + under_par_bonus + ace_bonus + first_win_bonus**,
then the daily cap.

- `diff`: **base** `owen` 400, `medium` 800, `hard` 1,500, `ultra` 3,000. Anything else →
  `sirsc_bad_reward`.
- `holes`: 9 or 18; **holes_mult** 1 for 9, 2 for 18. Anything else → `sirsc_bad_reward`.
- `place`: 1 to 4 (the player's place among themselves and the three rivals, ties sharing the better
  place); **place_mult** 1st 1, 2nd 0.6, 3rd 0.4, 4th 0.25.
- **member_mult** 1.5 for members, else 1.
- **under_par_bonus** = 150 × (par − strokes) when the round is under par, at most 3,000; else 0.
- **ace_bonus** = 500 × min(aces, 3) (holes in one this round).
- **first_win_bonus** 1,500 on the player's first 1st place of the UTC day in Putt Club, else 0.
- **Plausibility and limits** (else `sirsc_bad_reward`): `strokes` from `holes` to `holes × 40` (there's no stroke limit on a hole: past 8, or par + 5, the player can keep putting or give up for 2 penalty strokes); `par`
  from `holes × 2` to `holes × 11`; `aces` from 0 to `holes`; `duration_ms` at least `holes × 20,000`
  and at most 14,400,000 (4 hours). At most 12 rewarded rounds an hour per player →
  `sirsc_rate_limited`.
- **Daily cap: 25,000 coins a day (UTC) per player from `putt_reward`**, every bonus included. A reward
  that would pass it is cut to what's left (`capped: true`, possibly 0). `today` is what the player has
  earned from Putt Club today after this round, `daily_cap` is 25,000. These coins also count toward the
  wallet-wide 300,000-a-day cap of ECONOMY-API.md, whichever is hit first.
- Writes one ledger row (`reward`, game `putt`, coins = what was paid, note like `hard 18 1st -3`).

Examples: win 9 holes on Owen at par: 400. Win 18 on Hard 3 under par as a member: 1,500 × 2 × 1.5 +
450 = 4,950 (+1,500 if it's the first win today). 3rd on 9 holes of Ultra with an ace: 1,200 + 500.

## The catalog to seed (game `putt`)

Priced like the other games: 1 💎 = 5,000 coins, and coin prices are 75% of that. Every item has
`target = ''`, and `slot` set to the part before the colon (`ball`, `trail`, `sink`, `flag`, `scene`, `avatar`),
as Wildcard Chess's rows have, so `sirsc_equip('putt', …)` works for them. Everything is looks only; nothing changes how a ball plays.

| item_id | coins | 💎 | notes |
|---|---|---|---|
| ball:sunny | 7,500 | 2 | balls: the colour or pattern of your ball |
| ball:ruby | 7,500 | 2 | |
| ball:mint | 7,500 | 2 | |
| ball:beach | 15,000 | 4 | |
| ball:soccer | 15,000 | 4 | |
| ball:baseball | 15,000 | 4 | |
| ball:basketball | 15,000 | 4 | |
| ball:moon | 22,500 | 6 | |
| ball:gold | 30,000 | 8 | |
| ball:disco | – | 10 | diamonds only |
| ball:galaxy | – | 12 | diamonds only |
| ball:diamond | – | – | member_only, no claim window: every member can claim it while a member |
| trail:sparkle | 15,000 | 4 | trails: what follows a fast ball |
| trail:bubbles | 15,000 | 4 | |
| trail:petals | 22,500 | 6 | |
| trail:rainbow | 22,500 | 6 | |
| trail:fire | – | 10 | diamonds only |
| trail:stardust | – | 12 | diamonds only |
| trail:diamond | – | – | member_only, no claim window |
| sink:balloons | 15,000 | 4 | hole-outs: the celebration when your ball drops |
| sink:bubbles | 15,000 | 4 | |
| sink:fireworks | 22,500 | 6 | |
| sink:snow | 22,500 | 6 | |
| sink:lightning | – | 10 | diamonds only |
| sink:goldrush | – | 15 | diamonds only |
| flag:checkered | 7,500 | 2 | flags: the flag in every cup |
| flag:pirate | 7,500 | 2 | |
| flag:usa | 7,500 | 2 | the USA flag, with the hole number in place of the stars |
| flag:dragon | 15,000 | 4 | |
| flag:sirsc | – | – | member_only, no claim window |
| scene:sunset | 30,000 | 8 | scenery: sky, light and effects on every course (not the Abyss) |
| scene:blossom | 30,000 | 8 | |
| scene:night | 30,000 | 8 | |
| scene:aurora | – | 15 | diamonds only |
| scene:fireworks | – | 20 | diamonds only |
| scene:harvest | – | – | member_only, claim 2026-11-01T00:00Z to 2026-12-01T00:00Z (November 2026's members' scenery) |
| avatar:penguin | 7,500 | 2 | avatars: by your name in the menu and to friends online |
| avatar:cactus | 7,500 | 2 | |
| avatar:snowman | 15,000 | 4 | |
| avatar:fox | 15,000 | 4 | |
| avatar:dragon | 30,000 | 8 | |
| avatar:imp | – | 10 | diamonds only |
| avatar:unicorn | – | 12 | diamonds only |
| avatar:crown | – | – | member_only, no claim window |

`sirsc_member_claim('putt')` gives the member-only rows exactly as it does for the other games (window
items inside their window, no-window items while a member), with `target = ''`. Each month's new
members' content is one more `scene:<id>` row with that month's window.

The free defaults (`ball:classic`, `trail:plain`, `sink:confetti`, `flag:classic`, `scene:standard`,
`avatar:golfer`) are not catalog rows: everyone has them.

## Checklist

1. One migration: whatever private table the hourly limit, daily cap and first-win bonus need (or the
   economy's reward log with `game = 'putt'`), the `putt` catalog rows, `putt_ping`, `putt_reward`.
   Exact names, parameters, JSON keys and error codes.
2. `putt_reward` locks the wallet row and writes the ledger row in the same transaction.
3. Tests (as for the economy, no Docker): the formula for every difficulty, 9 and 18 holes, every
   place, the under-par bonus and its 3,000 limit, the ace bonus and its limit of 3, the member
   multiplier, the first-win bonus once per UTC day, the 25,000 cap (cut, then 0), the 300,000
   wallet-wide cap still applying, every plausibility error, the hourly limit, and `sirsc_buy` /
   `sirsc_member_claim` working with `game = 'putt'` (member-only items with and without a window).
4. Deploy to the Warden Chat project once SirSC says so.
