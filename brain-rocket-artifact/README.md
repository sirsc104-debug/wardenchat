# Brain Rocket: old artifact link

Brain Rocket now lives at https://brainrocket.sirsc104.com. The old claude.ai artifact link
(https://claude.ai/artifact/PUHp3Kt9B2xBPjHJYAfbBE) can show the game with one of these screens on top. **Right now it shows the plain game with no screen** (built with `none`).

| Screen | File | What it does |
|---|---|---|
| Switched off | `screen-off.html` | "This link has been switched off". Can't be closed. Links to the new site and to Warden Chat (https://chat.sirsc104.com) to ask SirSC questions. |
| Closeable | `screen-closeable.html` | "Brain Rocket has a new home!" Says the old page only works for a few more days; "Keep playing here for a few more days" or Escape closes it. |

Build either one, then publish the output to the same artifact link:

    python3 brain-rocket-artifact/build.py OUT_DIR off
    python3 brain-rocket-artifact/build.py OUT_DIR closeable
    python3 brain-rocket-artifact/build.py OUT_DIR none        # the plain game (live now)

These files are for the artifact only; `brain-rocket/` itself never shows either screen.
