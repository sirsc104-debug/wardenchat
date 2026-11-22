#!/usr/bin/env python3
"""Claude Lights cloud relay hook.

Runs in Claude Code *cloud* sessions and reports the session's status
(working / input / done / failed / end) to the relay, so the RGB lights on the home PC
can show it. Usage: claude_lights_cloud.py <state>

It does nothing unless both are true:
  * CLAUDE_CODE_REMOTE == "true"  (set by Claude Code in cloud sessions)
  * CLAUDE_LIGHTS_KEY is set      (the relay key, from the cloud environment's settings)
so local sessions on any machine, and anyone else who clones the repo, are unaffected.
It never fails the hook: every error is swallowed and it always exits 0.
"""
import json
import os
import sys
import tempfile
import time
import urllib.request

RELAY_URL = os.environ.get("CLAUDE_LIGHTS_URL", "https://alcihlboykgawpkpeaeq.supabase.co")
# Supabase publishable key: public by design, it only lets callers reach the lights_* functions,
# which still need the secret CLAUDE_LIGHTS_KEY.
ANON_KEY = os.environ.get("CLAUDE_LIGHTS_ANON", "sb_publishable_1Hc6cUrnIQCsm3FaKVZqZw_4cVSpeYR")
STATES = ("working", "input", "done", "failed", "end")
RESEND_SAME = 30      # seconds: a repeat of the same state is sent at most this often (a heartbeat)


def main():
    if os.environ.get("CLAUDE_CODE_REMOTE") != "true":
        return
    key = os.environ.get("CLAUDE_LIGHTS_KEY", "").strip()
    state = sys.argv[1] if len(sys.argv) > 1 else ""
    if not key or state not in STATES:
        return
    at = time.time()
    try:
        data = json.loads(sys.stdin.buffer.read().decode("utf-8-sig") or "{}")
    except Exception:
        data = {}
    sid = str(data.get("session_id") or os.environ.get("CLAUDE_CODE_REMOTE_SESSION_ID") or "cloud")[:100]
    cwd = data.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    repo = os.path.basename(str(cwd).rstrip("/\\"))[:100] or None

    # skip a repeat of the same state within RESEND_SAME seconds (PostToolUse fires a lot)
    mark = os.path.join(tempfile.gettempdir(), f"claude_lights_{sid}.json")
    try:
        with open(mark) as f:
            last = json.load(f)
        if last.get("state") == state and at - last.get("at", 0) < RESEND_SAME:
            return
    except Exception:
        pass
    try:
        with open(mark, "w") as f:
            json.dump({"state": state, "at": at}, f)
    except Exception:
        pass

    body = json.dumps({"p_key": key, "p_session": sid, "p_state": state, "p_repo": repo, "p_at": at}).encode()
    req = urllib.request.Request(
        RELAY_URL.rstrip("/") + "/rest/v1/rpc/lights_report", data=body, method="POST",
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=5).read()
    except Exception as e:
        # forget the mark so the next hook retries instead of waiting RESEND_SAME
        try:
            os.remove(mark)
        except Exception:
            pass
        if os.environ.get("CLAUDE_LIGHTS_DEBUG"):
            print(f"claude lights relay: {e!r}", file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
