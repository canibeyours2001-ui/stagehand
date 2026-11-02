#!/usr/bin/env bash
set -uo pipefail
# Keep the service running so systemd does not terminate its Chrome and VNC children.
# Check health periodically and recover any stopped components.
while true; do
  if ! /bin/bash /home/ubuntu/stagehand-oci/start-browser.sh; then
    echo 'Stagehand browser startup/health check failed; retrying in 20 seconds' >&2
  fi
  sleep 20
done
