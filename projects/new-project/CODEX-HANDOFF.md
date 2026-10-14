# Handoff to Codex: Apples to Oranges accounts and Fruit Dash races

**The front end is finished. The back end hasn't been started.** Your job is the back end: one
migration in the `warden-chat` repo, built from the two contracts in this folder. The front end
should need no changes once you match them.

- Repo: `sirsc104-debug/wardenchat`, branch `claude/nifty-maxwell-ugf318`, folder `projects/new-project/`
- Front-end commit: `d3ac394` ("Fruit Dash, Warden Chat accounts and live races (front end)")
- Contracts: [ACCOUNTS-API.md](ACCOUNTS-API.md) (sign-in, best scores, friends) and
  [RACES-API.md](RACES-API.md) (live Fruit Dash races)

## ✅ Done (front end, in this folder)

| Piece | Files | Notes |
| --- | --- | --- |
| Sign in with Warden Chat | `js/account.js`, `js/accountui.js` | Supabase Auth against Warden Chat's project, the same way Brain Rocket does it. Sign in, create account, profile, sign out, sync status, toasts, banned/suspended screen (uses Warden Chat's existing `my_account_state`) |
| Best-score sync | `js/account.js` | Browser-side merge (higher score wins per mode/difficulty), optimistic locking on `rev`, up to 3 retries on conflict |
| Friends UI | `js/accountui.js` | Add, accept, decline, cancel, remove; friends' Classic and Fruit Dash bests and race wins; friends' bests on the results screen |
| Fruit Dash mode | `js/game.js`, `js/kitchen.js`, `js/map.js`, `js/audio.js` | 60-second Classic, no lives, speed bonus, 3-2-1 countdown, solo practice, 8 fruit racers, 20-location kitchen, own music. Replaces Real Size on the menu |
| Live races UI | `js/race.js` | Host/join by code, invites (with toast and tab badge), lobby with fruit picker, server-clock countdown, live board, rivals in the kitchen, podium, play-again vote |
| Shared matchups | `js/pairs.js` (`Pairs.useSeed`) | The server's `seed` drives a seeded RNG, so every racer gets the same matchups in the same order. Checked: the same seed gives the same sequence on separate page loads |
| Gating | `js/account.js` | `a2o_ping` is called anonymously on load. If it doesn't answer 2xx, accounts and races stay hidden and Fruit Dash offers practice only. **This is what players see today.** |
| Pretend back end | `js/account-mock.js`, `build-artifact.py --accounts-demo` | Follows both contracts in localStorage, with pretend racers. Use it as a reference for expected behaviour and JSON shapes |
| Back-end contracts | `ACCOUNTS-API.md`, `RACES-API.md` | Every table, function, parameter, JSON shape, error code, grant and the checklists |
| Published | claude.ai artifact (v19), `dist/apples-to-oranges.html` | Production build, with accounts hidden until `a2o_ping` exists |

Tested in a headless browser against the pretend back end:
- Sign in, then a full 4-racer race: lobby, fruit pick, countdown, racing, results, vote, round 2.
- A 60-second practice dash.
- Classic, Guess the Number and Halloween smoke runs.

No console errors. **Not tested against a real Supabase**, because there isn't one yet.

## ❌ Not done (yours)

1. **The migration** in `warden-chat` (e.g. `supabase/migrations/<timestamp>_apples_to_oranges.sql`),
   applied after Brain Rocket's accounts migration (`20261010145850_brain_rocket_accounts.sql`).
   Brain Rocket's accounts and races migrations are the closest models.
2. **Accounts** (ACCOUNTS-API.md):
   - the `a2o_progress` table
   - `a2o_ping`, `a2o_get_progress`, `a2o_save_progress`, `a2o_friends`
   - `a2o_friend_request`, `a2o_friend_respond`, `a2o_friend_cancel`, `a2o_friend_remove`

   The four friend functions should reuse Brain Rocket's `br_friend_requests` and `br_friendships`
   tables. A wrapper that calls the `br_` function is fine: the front end treats `br_*` error codes
   the same as `a2o_*`.
3. **Races** (RACES-API.md):
   - the tables `a2o_races`, `a2o_race_players` (with `fruit`, unique per race among players who
     haven't left), `a2o_race_invites` and `a2o_race_results`
   - the twelve `a2o_race_*` functions, including the new `a2o_race_fruit`
   - row locking on join, fruit, start, vote and leave
4. **Session check:** every function except `a2o_ping` refuses no session *and* suspended or banned
   accounts with `a2o_not_signed_in` (reuse `warden_private.game_session_valid()`, as
   `br_assert_session()` does).
5. **Race wins:** write an `a2o_race_results` row when a round finishes. `a2o_friends.race_wins`
   counts from it, and it must survive the 1-day race cleanup.
6. **`scripts/verify.mjs` checks** listed in both contracts' checklists.
7. **Deploy** to the Warden Chat Supabase project. Nothing to change on the front end: the Sign in
   button and the race panel appear by themselves once `a2o_ping` answers.

## Differences from Brain Rocket's version (easy to miss)

- Prefix `a2o_`. Races take `diff` (`owen | medium | hard | ultra`), not `mode`.
- No `len` parameter: every race is 60 s. The state still returns `"len": 60`.
- Every player has a `fruit` 0–7. Joining gives the lowest free one. `a2o_race_fruit` switches,
  with the errors `a2o_fruit_taken`, `a2o_race_started` and `a2o_bad_race`.
- No `crashed`, anywhere.
- `a2o_race_finish` becomes `finished` 15 s after `ends_at` (not 20).
- Progress window: from `starts_at` (not −5 s). Score clamp 0–250,000, correct 0–200, and **never
  goes down** (keep the max of the stored and new values).
- `a2o_race_leave` on a `finished` race marks the player left and can complete a play-again vote.
- The progress doc is smaller: `{ schema: 1, bests: { <mode>: { <diff>: <score> } } }`, max 16 KB.
- `a2o_friends()` takes no `day` and returns `bests` and `race_wins` per friend.

## Not part of this handoff (later, maybe)

- Warden Chat profile pictures. The front end uses letter avatars. Brain Rocket's `br-avatars` edge
  function could be reused later, but that would need a front-end change.
- Supabase Realtime instead of polling (every 1.5 s in races, 10 s for invites). The contracts work
  either way.

## Trying it before the back end exists

```
cd projects/new-project
python3 build-artifact.py demo.html --standalone --accounts-demo
```

1. Open `demo.html`.
2. Sign in as `demo` / `oranges12345`.
3. Go to Fruit Dash → Host a race.
4. Use the DEMO bar's **Add a racer**, then start.

The DEMO bar can also send an invite, accept a friend request, go offline, or suspend you.
