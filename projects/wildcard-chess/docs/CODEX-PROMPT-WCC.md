Build the back end that lets Wildcard Chess pay out and spend SirSC coins and diamonds. It is a small addition to the SirSC wallet you already built for Downhill Death Run: two functions, one private table and the `wcc` catalog rows.

The contract is `projects/wildcard-chess/docs/ECONOMY-WCC.md` (in `sirsc104-debug/wardenchat`, or the copy handed to you with this prompt). It builds on `docs/ECONOMY-API.md` in `sirsc104-debug/claude`. Read both fully first and build exactly what ECONOMY-WCC.md specifies: names, parameters, JSON keys and error codes. The game's front end is already built against it, so don't change the interface; if something in it can't work, stop and say what and why.

Where it goes: one new migration in `sirsc104-debug/warden-chat`, on top of the SirSC economy migration, with the same conventions (RLS on every table and no client grants, `SECURITY DEFINER` with `set search_path = public, pg_temp`, the `warden_private.game_session_valid()` session check refusing as `sirsc_not_signed_in`, errors as `raise exception '<code>' using errcode = 'P0001'`, helpers in `warden_private`).

What to build (the checklist at the end of ECONOMY-WCC.md is the definition of done):
1. `wcc_ping()` (anon and authenticated) and `wcc_reward(level, result, plies, duration_ms, draft, codex)` with the exact formula, the plausibility checks, 20 rewarded games an hour, the **25,000-coin daily cap** for Wildcard Chess (inside the existing 300,000 wallet-wide cap), the once-a-day first-win bonus, and the lifetime codex bonus (500 per wildcard id, once each, outside the daily cap).
2. `warden_private.wcc_codex_paid` and any private tables the limits need.
3. The `wcc` catalog rows, and `sirsc_buy` / `sirsc_member_claim` working for `game = 'wcc'` (they should already, since they are per-game; check member-only items with and without a claim window).
4. Every balance change locks the wallet row, never goes below zero, and writes a ledger row in the same transaction.
5. Tests like the economy ones (native PostgreSQL, no Docker), with the existing Downhill Death Run and economy tests still passing.

Before you finish: run the full test suite, check every name and JSON key against ECONOMY-WCC.md, and report what you built, what the tests checked, and anything you had to interpret. Push the branch, but don't deploy to the live Warden Chat project until SirSC says so.
