#!/usr/bin/env bash
set -euo pipefail
BASE="${STAGEHAND_HOME:-$HOME/stagehand-oci}"
DISPLAY_NUM=":11"
AUTH="$BASE/Xauthority"
mkdir -p "$BASE/browser-data" "$BASE/logs"
chmod 700 "$BASE" "$BASE/browser-data" "$BASE/logs"
if [ ! -f "$AUTH" ]; then
  touch "$AUTH"
  chmod 600 "$AUTH"
  xauth -f "$AUTH" add "$DISPLAY_NUM" . "$(openssl rand -hex 16)" >/dev/null
fi
export DISPLAY="$DISPLAY_NUM" XAUTHORITY="$AUTH"
if ! pgrep -u "$(id -u)" -f "^/usr/bin/Xvfb :11 " >/dev/null; then
  nohup /usr/bin/Xvfb :11 -screen 0 1440x900x24 -nolisten tcp -auth "$AUTH" >"$BASE/logs/xvfb.log" 2>&1 </dev/null &
fi
sleep 1
if ! pgrep -u "$(id -u)" -f '^/usr/bin/x11vnc -display :11 ' >/dev/null; then
  nohup /usr/bin/x11vnc -display :11 -auth "$AUTH" -localhost -shared -forever -nopw -rfbport 5901 >"$BASE/logs/vnc.log" 2>&1 </dev/null &
fi
if ! pgrep -u "$(id -u)" -f '^/usr/bin/python3 /usr/bin/websockify --web /usr/share/novnc/ 127.0.0.1:6081 ' >/dev/null; then
  nohup /usr/bin/websockify --web /usr/share/novnc/ 127.0.0.1:6081 127.0.0.1:5901 >"$BASE/logs/websockify.log" 2>&1 </dev/null &
fi
if ! curl -fsS --max-time 2 http://127.0.0.1:9228/json/version >/dev/null 2>&1; then
  nohup /usr/bin/google-chrome --remote-debugging-address=127.0.0.1 --remote-debugging-port=9228 --remote-allow-origins='*' --enable-unsafe-extension-debugging --user-data-dir="$BASE/browser-data" --no-first-run --no-default-browser-check --disable-dev-shm-usage --disable-gpu https://example.com >"$BASE/logs/chrome.log" 2>&1 </dev/null &
fi
for i in $(seq 1 25); do
  if curl -fsS --max-time 2 http://127.0.0.1:9228/json/version >/dev/null 2>&1 && curl -fsS --max-time 2 http://127.0.0.1:6081/vnc.html >/dev/null 2>&1; then
    echo "STAGEHAND_BROWSER_READY"
    echo "Private viewer: http://127.0.0.1:6081/vnc.html (through SSH tunnel only)"
    echo "Local CDP: http://127.0.0.1:9228"
    exit 0
  fi
  sleep 1
done
echo "START_FAILED: inspect $BASE/logs (do not expose debugging or VNC ports publicly)" >&2
exit 1
