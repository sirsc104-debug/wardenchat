# SirSC Scroll browser tests

Playwright scripts (plain Node, no test runner). None of them contacts Supabase or YouTube: each one stands in for Supabase (route mocks), YouTube's player script (`ytmock/mock-iframe-api.js`) or Warden Chat (the demo build's pretend back end).

## Setup

```sh
cd projects/sirsc-scroll
npm install
npm i --no-save playwright && npx playwright install chromium   # once, if Playwright isn't installed

npm run build                      # dist/app   → served on :4173
npx vite build --mode demo         # dist/demo  → served on :4174 (pretend Warden Chat)
npm run build:single               # dist/sirsc-scroll.html (for embed-check)

npx vite preview --port 4173 --strictPort &
npx vite preview --mode demo --port 4174 --strictPort &
python3 -m http.server 4180 &      # from projects/sirsc-scroll, for embed-check
```

Screenshots go to `tests/e2e/out/` (git-ignored).

## The scripts

| Script | Build / port | What it checks | Expected |
| --- | --- | --- | --- |
| `social-demo-e2e.cjs` | demo :4174 | Sign-in screen and errors, first-run preferences, logo, no Friends/Upload/Share/Studio, like count, post/duplicate/reply/report/delete a comment, notifications from the pretend classmates, reload, `#/profile/me`, sign out, banned screen, phone layout | 43 PASS |
| `social-real-e2e.cjs` | app :4173 | Against a stand-in Supabase: the exact sign-in request, tokens on every call, `yt-` prefix stripped, server counts, unapproved video refuses likes, rate-limit message, token refresh before the first call, suspended screen + Check again, expired sign-in, offline start, sign out `scope=local` | 28 PASS |
| `mod-e2e.cjs` | app :4173 | `#/review/comments` with the review key: reported list, remove, restore, stop / allow an account | 10 PASS |
| `seed-check.cjs` | demo :4174 | Every video shows 7–20 comments; your own comment sorts first | 2 PASS |
| `embed-check.cjs [srcdoc\|write]` | :4180 + `dist/sirsc-scroll.html` | Loads the single file the way Google Sites does (`about:srcdoc`) and clicks the sidebar; the URL must stay `about:srcdoc` and pages must change | prints each page |
| `sidebar-check.cjs [url]` | demo :4174 | Clicks every sidebar item on a normal page | prints each hash |
| `catalog-e2e.cjs` | app :4173 | Older (V1.1) real-video suite, run with a saved sign-in (`seed-signin.js`) | 34/35: "liking … saved" expects the old browser-only likes |
| `review-e2e.cjs` | app :4173 | Older review-page suite, with a saved sign-in | 33/34: its stand-in API answers 404 to the new sign-in calls, which logs console errors |

Run one with `node tests/e2e/<script>` from `projects/sirsc-scroll`.
