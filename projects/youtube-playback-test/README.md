# SirSC Scroll · YouTube playback test

A standalone experiment, separate from the SirSC Scroll app (which is unchanged). It answers one question: can the official YouTube IFrame Player API give a fast, reliable, continuous short-video experience on school Chromebooks?

Everything is in one file, `index.html`: no build step, no backend, no API key. The only thing it loads is YouTube's own API script (`https://www.youtube.com/iframe_api`). It uses no proxies, downloaders or workarounds. A video a school blocks shows up in the results as blocked; the page never tries to get around it.

## What it does

- **One 9:16 player.** By default, one YouTube iframe is created once and reused. Every switch is `loadVideoById()` (or `cueVideoById()` when "Autoplay on switch" is off), so there are no page reloads and no new iframes. The iframe is also rebuilt when you change the "YouTube's own controls" option, because YouTube reads that setting only when the player is created.
- **Switching option.** **Switching: new player per video** destroys the player and creates a new one for each video, the same way the first video is always loaded. It was added because on a school Chromebook the first video played but every later `loadVideoById()` failed with error 152. Each load records which method was used (the **Switch** column, and `method` in the results), and the average switch time is kept separately for each method.
- **Navigation:**
  - Mouse wheel and trackpad: one gesture moves exactly one video, however much momentum it has.
  - Keyboard: ↑ ↓, J K and Page Up / Page Down.
  - On-screen previous and next buttons.
  - Touch swipes, when the gesture layer is on.
- **Controls:** play / pause (also Space), mute / unmute (also M), and a progress bar showing what's played and what's loaded (click it to seek; ← → seek 5 s when it's focused).
- **Errors:** every `onError` code is shown on the player with YouTube's meaning, plus Next and Retry. Optionally it skips failed videos after 2 seconds. Autoplay blocks (`onAutoplayBlocked`) get a Play / Play muted prompt. Loads that neither play nor fail within the timeout are counted separately.
- **Video list:** paste links or IDs, one per line. Watch, `youtu.be`, `/shorts/`, `/embed/` and `/live/` links all work. Anything after `#` is your label (for example `# works on youtube.com` or `# blocked at school`). Labels are carried into every result so you can compare expected and actual behaviour. The list and options are saved in the browser.
- **Check list:** cues every video once without playing it and records whether the player accepted it (CUED, an error code, or no response) and how long that took. It's a quick way to confirm the IDs on the device you're testing.
- **Error-handling test:** loads the text `not a video id`, which can never be a YouTube ID, to confirm errors are caught. It is never added to your list.
- **Results:** Export results downloads everything as JSON. Copy JSON and Show JSON (a box you can select and copy from) cover managed Chromebooks and embeds that block downloads.

## What it measures, exactly

All times are taken in the page with `performance.now()`.

| Measurement | Definition |
| --- | --- |
| Request → PLAYING | From the page calling `loadVideoById()` (or creating the player, for the first video and with **new player per video**) until the player **reports** state PLAYING (1) to the page. It includes YouTube's own loading and the message hop from the iframe. It is not time to first frame; the API doesn't expose that. |
| Request → first event | Until the first state event of any kind: how quickly the player reacts at all. |
| Time in BUFFERING | The sum of the gaps between each BUFFERING (3) event and the next state event, as reported. "Rebuffers after start" counts returns to BUFFERING after playback began. |
| Average switch time | Mean, median and p90 of Request → PLAYING for every video after the first that started on its own. Videos you had to start by pressing Play (after an autoplay block, for example) are kept out of this average. The first video is reported on its own, because it includes the player's startup. |
| Successful loads | Loads that reached PLAYING. |
| Failed loads | Loads that got an `onError` event. The code, count and meaning are listed in the Errors table. |
| Autoplay blocked | Count of `onAutoplayBlocked` events from the player. |
| No-start timeouts | Loads with neither PLAYING nor an error within the timeout (12 s by default). |
| Position | `getCurrentTime()` / `getDuration()`, read four times a second only while a video is playing. |
| Loaded fraction | `getVideoLoadedFraction()`, as the player reports it. |
| API script ready, Player ready | Time from page start to `onYouTubeIframeAPIReady`, and to the player's `onReady`. |

The IFrame API doesn't report network requests, bitrate, resolution actually played, dropped frames or decode time, so the page doesn't claim any of them. The Environment panel records the browser's own (approximate) CPU, memory and network estimates so runs on different devices can be compared.

## Hosting it

The page has to be opened from an **https** web address. YouTube identifies embeds by the page's origin and Referer. Opened straight from a file (`file://`) there is neither, and videos will mostly fail (the page shows a warning).

**Google Sites works:** pasted into a Google Site with Insert → Embed → Embed code, the videos load. That's the same way the other SirSC projects are published, so it's the most realistic setup to test. There are two ways to do it:

- **Open in a new tab (recommended).** Paste the contents of `dist/youtube-playback-test-google-sites.html` as the embed code. The site shows a small card with an **Open the test in a new tab** button. Pressing it opens a blank (`about:blank`) tab and writes the whole test into it, so the player gets the full window and full screen works. The tab runs from the same embed origin as the card, so YouTube sees the same origin and Referer as an embedded run. In that tab, the Environment panel shows "Opened by: the Google Sites launcher (new tab)", and the results record `openedInNewTabByLauncher` and `documentOrigin`. Two things to know:
  - Reloading or closing that tab clears it, because there's no address to reload. Go back to the site and press the button again. The video list and options are kept.
  - If the browser blocks the pop-up, the card says so and offers **Run it here instead**, which runs the test inside the embed.
- **Inside the embed.** Paste `index.html` itself as the embed code. The page then runs inside Google's embed frame, and the Environment panel shows "In a frame: yes". Drag the embed's corners to make it tall enough for the 9:16 player.

The launcher file is generated from `index.html`. After changing `index.html`, run `python3 build-sites.py` in this folder to rebuild it. Chrome often blocks downloads from Google Sites pages, so if **Export results** does nothing, use **Copy JSON** or **Show JSON** (select the text in the box and copy it).

Any static https host works. Two easy options:

**GitHub Pages (this repository)**
1. On GitHub, open `sirsc104-debug/wardenchat` → **Settings** → **Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, pick the branch with this folder (for example `claude/sirsc-scroll-v1-d60v4k`, or `main` once it's merged) and the `/ (root)` folder, then **Save**.
3. After a minute or two the test is at `https://sirsc104-debug.github.io/wardenchat/projects/youtube-playback-test/`.

GitHub Pages on a private repository needs a paid GitHub plan. If that's a problem, use the next option.

**Netlify Drop**: go to `https://app.netlify.com/drop` and drag the `youtube-playback-test` folder onto the page. It gives you an https address straight away.

For a quick check on a computer first, a local server is fine: run `python3 -m http.server 8000` in this folder and open `http://localhost:8000`. Do the real test from the https address.

## Testing on a Chromebook

1. Sign in with the **school account** on a school Chromebook, so the school's real policies and network apply. Open the https address in Chrome.
2. Wait for **Player ready** in Live measurements. If a red banner says the API script couldn't load, `www.youtube.com` is blocked on that network or device. That is itself a result; write it down.
3. Press **Check list**. The Cue check table shows which IDs this device accepts.
4. Optionally replace the list. Paste a mix of:
   - Shorts links (`youtube.com/shorts/…`), the real vertical case;
   - videos that play on youtube.com on this Chromebook, labelled `# works on youtube.com`;
   - videos that are blocked or restricted at school, labelled `# blocked at school`.

   Then press **Use this list**.
5. Watch through the list using the wheel or trackpad, the arrow keys and the buttons. Try a fast run of several switches in a row, then a slower run that lets each video play for a while.
6. If the first video plays but later ones fail (error 152 was reported on a school Chromebook), set **Switching** to **new player per video**, switch a few times and compare. Note which videos still fail: a video the school blocks should keep failing either way.
7. Test sound and autoplay: untick **Start muted**, reload the page, and note whether **Autoplay blocked** goes up before you've clicked anything.
8. Optionally tick **Gesture layer** and try scrolling and swiping directly over the picture, to feel the difference.
9. Press **Export results**. If downloads are blocked (common inside Google Sites), use **Copy JSON** or **Show JSON** instead, and keep the text.
10. Repeat on an unmanaged device or a home network if you can, so school restrictions can be told apart from YouTube or performance problems.

Rough guide for reading the numbers: a median switch under about 1 second feels close to instant; 1 to 2 seconds is workable if SirSC Scroll shows its own placeholder while loading; consistently over 2 seconds, or frequent rebuffers, would argue for preloading the next video in a second, hidden player (worth testing next if needed). Errors 101 and 150 mean the owner disallows embedding. Error 100 means the video is unavailable, which on a school account can also mean it's restricted. Error 153 points to a missing Referer.

## Things to know

- **Default list:** the default IDs are widely published, well-known public videos (YouTube's own API documentation sample, "Me at the zoo", Blender Foundation films and several of the most-viewed music videos). They were not verified from the machine that built this page, because YouTube was blocked there. Press **Check list** on the device under test. All of them are landscape, so they're letterboxed in the 9:16 player. Add Shorts links for the true vertical case. The second entry, `_N2CPJS-mHw`, is a video the tester reported as blocked at school, included to see what a blocked video does in the embed. A saved list that is still the earlier, unedited default is switched to the new one automatically; an edited list is left as it is (use **Restore default list** to get the new default).
- **Scrolling over the video:** the browser sends scrolls, clicks and key presses over the YouTube iframe to YouTube, not to this page. Normally you scroll on the controls or beside the video, and use the keyboard while focus is on the page. The page notices when focus moves into the player and says so. The gesture layer routes input over the picture to the page instead, which stops YouTube's on-video controls responding. It's only there to measure that experience: check YouTube's embedded-player policies before using that pattern in SirSC Scroll.
- **Error 153:** the description in the page comes from memory, because Google's developer documentation couldn't be fetched from the build machine.
- **Error 152** isn't in Google's documentation, so the page doesn't give it a meaning. On the school Chromebook it came from every `loadVideoById()` after the first video.
- **How it was tested:** every page behaviour above was tested in headless Chromium against a local stand-in for the IFrame API that imitates the player's events (including error codes, blocked autoplay and video end), without contacting YouTube. That covers navigation, one-gesture-one-video, controls, error handling, the cue check, the autoplay-blocked path, export and the file:// warning. The Google Sites launcher was tested in a sandboxed, cross-origin frame like Google's: the new tab, playback in it, the recorded origin, and the blocked-pop-up fallback. It has **not** yet played real YouTube video. That's what the Chromebook run is for.
