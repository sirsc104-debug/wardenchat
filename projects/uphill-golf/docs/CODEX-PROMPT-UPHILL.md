Build the back end that lets Uphill Golf pay out and spend SirSC coins and diamonds. It is a small addition to the SirSC wallet you already built for Downhill Death Run and Wildcard Chess: four functions, three private tables and the `uphill` catalog rows. There is no online play, so there is nothing realtime: one reward function, a per-player bests table and a public daily leaderboard.

The full contract is pasted below this prompt, between the two `=====` lines (it is also `projects/uphill-golf/docs/ECONOMY-UPHILL.md` in `sirsc104-debug/wardenchat`, branch `claude/focused-clarke-ahqjs7`, next to the game itself at `projects/uphill-golf/index.html`). It builds on `docs/ECONOMY-API.md` in `sirsc104-debug/claude`, the SirSC wallet contract you already built. Read both fully first and build exactly what ECONOMY-UPHILL.md specifies: names, parameters, JSON keys and error codes. The game's front end is already built against it, so don't change the interface; if something in it can't work, stop and say what and why.

Where it goes: one new migration in `sirsc104-debug/warden-chat`, on top of the SirSC economy migration (and the Wildcard Chess one, if it is there), with the same conventions (RLS on every table and no client grants, `SECURITY DEFINER` with `set search_path = public, pg_temp`, the `warden_private.game_session_valid()` session check refusing as `sirsc_not_signed_in`, errors as `raise exception '<code>' using errcode = 'P0001'`, helpers in `warden_private`).

What to build (the checklist at the end of ECONOMY-UPHILL.md is the definition of done):
1. `uphill_ping()` (anon and authenticated) and `uphill_reward(hole_id, strokes, par, duration_ms, no_checkpoints, day)` with the exact formula (base by world, the under-par bonus from the **server's** par, the ace, the flat once-a-day bonus for today's hole, the member multiplier), the per-hole stroke floors and duration checks, the day window for today's hole, 60 rewarded holes an hour, the **25,000-coin daily cap** for Uphill Golf (inside the existing 300,000 wallet-wide cap), and the lifetime first-clear bonus (500 per hole, once each, outside the daily cap, handled against the wallet-wide cap the way `wcc_reward` handles the codex bonus).
2. Recording in the same call: the player's best per hole, their best on the day's hole (the leaderboard), the reward log, and the five earned items (one per world finished, and the pennant for par or better on all 36 holes) added to `sirsc_owned` the way `sirsc_member_claim` adds member items.
3. `uphill_bests()` (authenticated) and `uphill_daily_board(day)` (anon and authenticated; never refuses for the session, answers a signed-out caller with `you: null`; leaves out restricted accounts).
4. `warden_private.uphill_holes` seeded with the 36 holes (the server's only source for par and floor), `warden_private.uphill_bests`, `warden_private.uphill_daily`, and whatever the limits need.
5. All the `uphill` catalog rows (balls, trails, hole-outs, flags, scenery, the member-only items and the five earned items with no price), and `sirsc_buy` / `sirsc_member_claim` working for `game = 'uphill'` (they should already, since they are per-game; check member-only items with and without a claim window, and that the earned items can't be bought).
6. Every balance change locks the wallet row, never goes below zero, and writes a ledger row in the same transaction; the first-clear and daily bonuses are never paid twice, even for two calls at once.
7. Tests like the economy ones (native PostgreSQL, no Docker), with the existing Downhill Death Run, Wildcard Chess and economy tests still passing. Days are UTC, so make the current time injectable or set it in tests the way the economy tests do, to cover midnight, the 02:00 window and the 30-day bests.

Before you finish: run the full test suite, check every name and JSON key against ECONOMY-UPHILL.md, and report what you built, what the tests checked, and anything you had to interpret. Push the branch, but don't deploy to the live Warden Chat project until SirSC says so.

===== ECONOMY-UPHILL.md (the contract) =====

# Uphill Golf on the SirSC wallet: the back-end contract

Uphill Golf uses the SirSC wallet that Downhill Death Run and Wildcard Chess already use: the same
Warden Chat accounts, the same `sirsc_wallets` / `sirsc_ledger` / `sirsc_catalog` / `sirsc_owned`
tables, and the same `sirsc_me`, `sirsc_member_claim`, `sirsc_buy`, `sirsc_request_diamonds` and
`sirsc_cancel_request` functions, called with `game = 'uphill'`. That contract is `docs/ECONOMY-API.md`
in `sirsc104-debug/claude`; everything there applies unchanged. This file is only what Uphill Golf
adds:
- four functions: `uphill_ping`, `uphill_reward`, `uphill_bests` and `uphill_daily_board`;
- three private tables: the holes, each player's bests, and the daily leaderboard;
- the `uphill` catalog rows.

Conventions as in ECONOMY-API.md:
- One new migration in `sirsc104-debug/warden-chat`, on top of the SirSC economy migration (and the
  Wildcard Chess one, if it is there).
- RLS on, and no table grants to `anon` or `authenticated`.
- `SECURITY DEFINER` functions with `set search_path = public, pg_temp`.
- The session check `warden_private.game_session_valid()`, refusing as `sirsc_not_signed_in`.
- Errors raised as `raise exception '<code>' using errcode = 'P0001'`.
- Grants to `authenticated` only. `uphill_ping` and `uphill_daily_board` are granted to `anon` too.

The front end is `projects/uphill-golf/index.html` in `sirsc104-debug/wardenchat`, a single file. Its
`Account`, `Wallet` and `Board` sections were built against this contract, along with a pretend back
end that follows it. The pretend back end is the block that starts
`if(UPHILL_CONFIG.demo&&!window.UPHILL_HEADLESS)`. The hosted build sets
`window.UPHILL_ACCOUNTS = { demo: false }` before the game's script, which switches it to the real
back end.

There is no online play. Coins come from finishing holes alone, so `uphill_reward` is the only way
this game pays.

## Holes and days

- **The 36 regular holes** have stable ids such as `meadow-1` or `abyss-9`, in four worlds of nine.
  They are listed at the end of this file with their par and stroke floor.
  - The server keeps the table in `warden_private.uphill_holes` and believes only that. The `par` the
    game sends is ignored for regular holes.
  - Ids are names, not play order: `meadow-9` is played 8th, and `meadow-8` last.
- **Today's hole** has the id `daily`. The game builds it from the date, so it is the same for
  everyone on that date.
  - A day is a **UTC date**, `YYYY-MM-DD`. The hole and its leaderboard turn over at midnight UTC.
  - The server never sees the layout, so it can't know the par. Today's hole pays a flat bonus, and
    the only stroke check is a general floor of 4.

## `uphill_ping() returns boolean`

Returns `true`. Callable anonymously. The game calls it on load. Until it answers, accounts stay
hidden and the game works exactly as it does signed out.

## `uphill_reward(hole_id text, strokes integer, par integer, duration_ms integer, no_checkpoints boolean, day text) returns json`

The game calls this once each time a signed-in player sinks the ball on a regular hole or on today's
hole. It never calls it for the practice ledge. Each call:
1. checks the finish is believable;
2. pays the coins;
3. records the player's best (and their place on the day's leaderboard, for today's hole);
4. gives any items the player has just earned.

It returns:

```jsonc
{ "coins": 1700, "base": 350, "under_par_bonus": 450, "ace_bonus": 0, "daily_bonus": 0,
  "first_clear_bonus": 500, "member_mult": 1.5, "capped": false, "today": 6200, "daily_cap": 25000,
  "earned": ["trail:icicle"], "board": null, "me": <sirsc_me('uphill')> }
```

That example is Winter's Summit (`winter-6`, par 10) in 7 strokes, for a member, the first time they
have finished it.

**coins = floor((base + under_par_bonus + ace_bonus + daily_bonus) × member_mult)**, then the daily cap
is applied, then **+ first_clear_bonus**, which is outside the cap.
- `base`, `under_par_bonus`, `ace_bonus`, `daily_bonus` and `first_clear_bonus` are the amounts before
  the multiplier and the cap.
- `coins` is what was actually paid. The game shows each part, then counts up to `coins`.

The parts of the formula:
- **base**: by the hole's world. Meadow 150, Canyon 250, Winter 350, Abyss 500. It is 0 on today's
  hole.
- **under_par_bonus**: 150 × the strokes under par (the table's par), up to 3, so at most 450.
  - 0 at par or over.
  - 0 on today's hole.
- **ace_bonus**: 1,000 for a hole in one (`strokes = 1`) on a regular hole. It is only possible where
  the hole's floor is 1.
- **daily_bonus**: 1,500 the first time the player finishes that day's hole. It is 0 for every later
  finish of the same day's hole.
  - Later finishes pay nothing, but they still improve the player's place on the board.
- **member_mult**: 1.5 for members, else 1 (as a JSON number).
- **first_clear_bonus**: 500 the first time the player ever finishes each regular hole. That is
  when they have no best recorded for it before this call.
  - Once per hole, ever: at most 36 × 500 = 18,000 coins per player.
  - It is outside the daily cap and paid even when `capped`.
  - Treat it against the wallet-wide cap exactly as `wcc_reward` treats Wildcard Chess's codex bonus.
  - It is never paid on today's hole.

**The daily cap is 25,000 coins a day (UTC) per player from `uphill_reward`.** It covers everything
except the first-clear bonus.
- A reward that would pass the cap is cut to what's left, with `capped: true`. The amount can be 0.
- `today` is what the player has earned from Uphill Golf today, after this call. It counts toward the
  cap, so it leaves out first-clear bonuses.
- `daily_cap` is 25,000.
- These coins also count toward the wallet-wide 300,000-a-day cap of ECONOMY-API.md, whichever is hit
  first.

**Plausibility.** Any of these is refused with `sirsc_bad_reward`:
- `hole_id` is neither in `warden_private.uphill_holes` nor `daily`.
- `strokes` is null, below the hole's floor (4 for `daily`), or above 60.
- `duration_ms` is null, below 1,500 × least(strokes, 8), or above 7,200,000 (2 hours).
- For `daily`, `day` is not `YYYY-MM-DD` naming either:
  - the current UTC date; or
  - the previous UTC date while the current UTC time is before 02:00, for a round begun before
    midnight. The game sends the date of the hole it built, not the date it finished on.

For regular holes, `day` and `par` are ignored (the game sends `null` and its own par). A null
`no_checkpoints` counts as false.

**Hourly limit.** At most 60 rewarded holes per player in any rolling 60 minutes. The 61st is refused
with `sirsc_rate_limited`. A refused call, for any reason, changes nothing and doesn't count.

The checks run in this order: the session check, then plausibility, then the hourly limit. Then the
function locks the wallet row and does everything below in one transaction.

**Recording.** This happens on every accepted call, even when the pay is 0 or capped:
- **A regular hole**: the player's best for the hole, in `warden_private.uphill_bests`.
  - The row is written when there is none, or when `strokes` is lower than the stored best.
  - A tie keeps the earlier row and its time.
  - `no_checkpoints` is stored with the run that set the best. It has no effect on coins or ranking
    for now.
- **Today's hole**: the player's best for that day, in `warden_private.uphill_daily`, by the same
  rule. This table is the leaderboard.
- **Every call**: a row in a reward log (the player, time, game `uphill`, hole id, and the capped
  coins), for the hourly limit and the daily cap.

**Earned items.** After recording, the function checks each item below that the player doesn't own
yet. Each one the player now qualifies for is added to `sirsc_owned` (game `uphill`, `target = ''`) the
way `sirsc_member_claim` adds member items. No coins move.

| item_id | earned by |
|---|---|
| ball:daisy | a best recorded on all 9 Meadow holes |
| sink:bloom | a best recorded on all 9 Canyon holes |
| trail:icicle | a best recorded on all 9 Winter holes |
| ball:magma | a best recorded on all 9 Abyss holes |
| flag:pennant | a best at or under par on all 36 holes |

- `earned` lists what this call gave, in the order of that table. It is usually `[]`.
- Today's hole never counts toward these items.
- If holes are added later, items already given stay given.

**Ledger.** The function writes one `reward` ledger row, with game `uphill`, when `coins` > 0.
- `coins` on the row is the total paid.
- The note reads like `winter-6 7/10 +first` (strokes/par), or `daily 2026-11-17 9`.

**Board.** For `daily`, `board` is what `uphill_daily_board(day)` returns for this player after
recording. The game shows it under the result. For regular holes it is `null`.

`me` is `sirsc_me('uphill')` after the change.

Examples:
- Meadow's First tee (par 3) in 3, the first time: 150 + 500 = 650. Afterwards: 150.
- Canyon's Thermals (par 5) in 3: 250 + 300 = 550.
- A hole in one on First tee: 150 + 300 + 1,000 = 1,450.
- Winter's Summit (par 10) in 7 as a member: (350 + 450) × 1.5 = 1,200.
- Abyss's Lake of Fire (par 12) in 20: 500.
- Today's hole, first finish: 1,500 (2,250 for a member). Finishing it again that day: 0.

## `uphill_bests() returns json`

Authenticated, with the session check. It returns the player's bests as one object:

```jsonc
{ "meadow-1": 3, "canyon-5": 4, "abyss-9": 14, "daily-2026-11-17": 9 }
```

- The object has every regular hole with a best.
- It also has `daily-<day>` for each of the last 30 UTC days, today included, on which the player
  finished today's hole.
- It is `{}` when there are none.
- The game calls this after sign-in. On each device it keeps the lower of its own best and the
  server's.

## `uphill_daily_board(day text) returns json`

Granted to `anon` and `authenticated`. The leaderboard is public, so you don't need to sign in to see
it.
- `day` must be a real date written `YYYY-MM-DD`, otherwise the call fails with `uphill_bad_day`.
- Any day can be asked for. A day with no scores gives `total: 0` and `entries: []`.

It returns:

```jsonc
{ "day": "2026-11-17", "total": 23,
  "entries": [ { "rank": 1, "username": "Fern", "strokes": 6, "member": true, "you": false } ],
  "you": { "rank": 14, "strokes": 9 } }
```

- **One entry per account**: its best on that day's hole.
- **Order**: strokes ascending, then the time that best was first reached (earlier first), then user
  id.
- **Ranks**:
  - `rank` is the 1-based position in that order. Ranks are never shared.
  - `entries` is the first 10.
  - `total` is how many accounts are ranked.
- **Fields**:
  - `username` is the account's Warden Chat username.
  - `member` is whether the account is a SirSC member now.
- **Who is left out**: accounts Warden Chat currently restricts, the ones `my_account_state` reports
  as not active. They are not counted in `total`, and the ranks close up.
- **The caller**: when the caller is signed in and has a valid session:
  - `you` is their rank and strokes, if they are on the board, else `null`;
  - their entry in `entries`, if it is there, has `you: true`.
- **Never refuses for the session.** If `auth.uid()` is null or the session check fails, it answers as
  for a signed-out caller: `you: null`, and every `you` flag false.

## Private tables

These are suggested names. Each user's rows go when the account is deleted, like the economy's
tables.
- `warden_private.uphill_holes (hole_id text primary key, world text, par integer, floor integer)`,
  seeded with the table below. These rows are the server's only source for par and floor.
- `warden_private.uphill_bests (user_id, hole_id references uphill_holes, strokes, no_checkpoints,
  achieved_at, primary key (user_id, hole_id))`.
- `warden_private.uphill_daily (day date, user_id, strokes, no_checkpoints, achieved_at, primary key
  (day, user_id))`, with an index on `(day, strokes, achieved_at)`.
- The reward log for the hourly limit and daily cap: reuse the economy's reward log with
  `game = 'uphill'` if it fits, or add `warden_private.uphill_rewards`.

## The holes (seed `warden_private.uphill_holes`)

**Floor** is the fewest strokes the server will believe: max(1, least(fewest, par) − 2). Fewest is the
lowest a brute-force solver found when the hole was built.
- On holes where the solver found worse than par, the floor counts from par.
- The game's pretend back end uses the same floors.

| # | hole_id | world | name | par | floor |
|---|---|---|---|---|---|
| 1 | meadow-1 | meadow | First tee | 3 | 1 |
| 2 | meadow-2 | meadow | Switchbacks | 5 | 3 |
| 3 | meadow-3 | meadow | Bunkers | 5 | 3 |
| 4 | meadow-4 | meadow | Frost | 6 | 4 |
| 5 | meadow-5 | meadow | Water carry | 6 | 4 |
| 6 | meadow-6 | meadow | Trampoline | 6 | 3 |
| 7 | meadow-7 | meadow | Moving parts | 7 | 5 |
| 8 | meadow-9 | meadow | Duck Pond | 7 | 4 |
| 9 | meadow-8 | meadow | Kinda hard | 10 | 7 |
| 1 | canyon-1 | canyon | Dry Creek | 4 | 2 |
| 2 | canyon-2 | canyon | Updraft | 4 | 2 |
| 3 | canyon-3 | canyon | Crumble Steps | 6 | 4 |
| 4 | canyon-4 | canyon | Cactus Alley | 7 | 4 |
| 5 | canyon-5 | canyon | Thermals | 5 | 2 |
| 6 | canyon-8 | canyon | Dust Devils | 6 | 3 |
| 7 | canyon-7 | canyon | Hoodoos | 7 | 4 |
| 8 | canyon-9 | canyon | Slot Canyon | 8 | 5 |
| 9 | canyon-6 | canyon | Mesa Top | 8 | 5 |
| 1 | winter-1 | winter | Snowdrifts | 6 | 3 |
| 2 | winter-2 | winter | Thin Ice | 8 | 5 |
| 3 | winter-3 | winter | Penguin Patrol | 7 | 4 |
| 4 | winter-4 | winter | Whiteout | 7 | 4 |
| 5 | winter-5 | winter | Icefall | 7 | 4 |
| 6 | winter-8 | winter | Penguin Parade | 8 | 5 |
| 7 | winter-9 | winter | Blizzard Ridge | 8 | 5 |
| 8 | winter-7 | winter | Frozen Falls | 9 | 6 |
| 9 | winter-6 | winter | Summit | 10 | 7 |
| 1 | abyss-1 | abyss | Gates of Dis | 8 | 4 |
| 2 | abyss-2 | abyss | Obsidian Slide | 10 | 6 |
| 3 | abyss-3 | abyss | Tar Pits | 10 | 6 |
| 4 | abyss-4 | abyss | Imp Patrol | 11 | 7 |
| 5 | abyss-5 | abyss | Geyser Leap | 11 | 6 |
| 6 | abyss-6 | abyss | Magma Pinball | 10 | 5 |
| 7 | abyss-7 | abyss | Doom Pendulum | 9 | 4 |
| 8 | abyss-8 | abyss | Portal Maze | 9 | 3 |
| 9 | abyss-9 | abyss | Lake of Fire | 12 | 8 |

Pars by world: Meadow 55, Canyon 55, Winter 70, Abyss 90.

## The catalog to seed (game `uphill`)

Priced like the other games: 1 💎 = 5,000 coins, and a coin price is 75% of that. Every item has
`target = ''`.

| item_id | coins | 💎 | notes |
|---|---|---|---|
| ball:sunny | 7,500 | 2 | balls |
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
| trail:sparkle | 15,000 | 4 | trails follow the ball in flight |
| trail:bubbles | 15,000 | 4 | |
| trail:petals | 22,500 | 6 | |
| trail:rainbow | 22,500 | 6 | |
| trail:fire | – | 10 | diamonds only |
| trail:stardust | – | 12 | diamonds only |
| trail:diamond | – | – | member_only, no claim window |
| sink:balloons | 15,000 | 4 | hole-outs play when the ball drops |
| sink:bubbles | 15,000 | 4 | |
| sink:fireworks | 22,500 | 6 | |
| sink:snow | 22,500 | 6 | |
| sink:lightning | – | 10 | diamonds only |
| sink:goldrush | – | 15 | diamonds only |
| flag:checkered | 7,500 | 2 | flags on the pin |
| flag:pirate | 7,500 | 2 | |
| flag:usa | 7,500 | 2 | |
| flag:dragon | 15,000 | 4 | |
| flag:sirsc | – | – | member_only, no claim window |
| scene:sunset | 30,000 | 8 | scenery restyles the sky and backdrop of every world |
| scene:blossom | 30,000 | 8 | |
| scene:night | 30,000 | 8 | |
| scene:aurora | – | 15 | diamonds only |
| scene:fireworks | – | 20 | diamonds only |
| scene:harvest | – | – | member_only, claim 2026-11-01T00:00Z to 2026-12-01T00:00Z (November 2026's members' scenery) |
| ball:daisy | – | – | earned, see below |
| sink:bloom | – | – | earned |
| trail:icicle | – | – | earned |
| ball:magma | – | – | earned |
| flag:pennant | – | – | earned |

`sirsc_member_claim('uphill')` gives the member-only rows exactly as it does for `ddr` and `wcc`:
items with a window inside their window, and items without one while a member, with `target = ''`.
Each month's new members' content is one more `scene:<id>` row with that month's window.

The five **earned** rows have no coin price, no diamond price and `member_only` false:
- `sirsc_buy` refuses them, as it refuses any currency an item has no price in.
- `sirsc_member_claim` skips them.
- Only `uphill_reward` gives them out.
- They are catalog rows so that `sirsc_owned` can point at them and `sirsc_me` lists them as owned.

The free defaults are not catalog rows, because everyone has them: `ball:classic`, `trail:plain`,
`sink:confetti`, `flag:classic` and `scene:standard`.

## Checklist

1. **One migration** containing:
   - `warden_private.uphill_holes` seeded with the 36 rows above;
   - `warden_private.uphill_bests` and `warden_private.uphill_daily`;
   - whatever the hourly limit and daily cap need (or the economy's reward log with
     `game = 'uphill'`);
   - the `uphill` catalog rows;
   - `uphill_ping`, `uphill_reward`, `uphill_bests` and `uphill_daily_board`.

   Use exact names, parameters, JSON keys and error codes.
2. **`uphill_reward` is safe under concurrent calls.** It locks the wallet row, and never pays a
   first-clear bonus or a daily bonus twice, even for two calls at once. It records bests, gives items
   and writes the ledger row in the same transaction.
3. **Tests**, as for the economy (no Docker), covering:
   - **The formula**:
     - the base for each world;
     - the under-par bonus at 0, 1, 2, 3, and 4 under (still 450);
     - the ace;
     - the client's `par` being ignored on a regular hole;
     - the member multiplier.
   - **Today's hole**:
     - the bonus once per day, with no under-par or ace bonus;
     - 0 on later finishes;
     - the day window (today; yesterday before and after 02:00 UTC; tomorrow; a bad format).
   - **The first-clear bonus**: once per hole, outside the cap, and paid when capped.
   - **The caps**: the 25,000 cap (cut, then 0), and the 300,000 wallet-wide cap still applying.
   - **Plausibility**: the floors, 60 strokes, the duration bounds, and unknown hole ids.
   - **The hourly limit**: the 61st call refused, and refused calls not counting.
   - **Bests**: lower replaces, and a tie keeps the earlier time.
   - **The earned items**: each world's item, and the pennant only once every hole is at or under
     par. Each is given once, and `sirsc_buy` refuses them.
   - **`uphill_bests`**: holes, plus the last 30 days of daily bests.
   - **The board**:
     - order and tie-break;
     - the top 10;
     - `total` and `you`;
     - restricted accounts left out;
     - signed-out callers answered;
     - `uphill_bad_day`.
   - **The wallet functions** with `game = 'uphill'`: `sirsc_buy` and `sirsc_member_claim`, covering
     `scene:harvest` inside and outside its window and the no-window member items.
4. **Deploy** to the Warden Chat project once SirSC says so.

===== end of the contract =====
