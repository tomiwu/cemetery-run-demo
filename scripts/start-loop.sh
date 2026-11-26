#!/usr/bin/env bash
# Start the Sandcastle loop of cemetery-run-demo one time. Safe to call many times at the same moment.
# Fixed paths (the loop-health routine reads them):
#   pid    /tmp/cemetery-run-demo-loop.pid
#   status /tmp/cemetery-run-demo-loop.status.json (phase, lastOutputAt)
#   log    <repo>/.sandcastle/logs/loop.log (appended; agent logs are in the same folder)
# Image: localhost/sandcastle:cemetery-run-demo. This script does not build the image.
#
# Secrets (directory /workspace/cemetery-run-demo-secrets, mode 700, never in git):
#   gh-pat               fine-grained PAT; written to GH_TOKEN for the host and the containers
#   loop-webhook-url     LOOP_WEBHOOK_URL, orchestrator process only
#   loop-webhook-key     LOOP_WEBHOOK_KEY, orchestrator process only
set -euo pipefail
NAME=cemetery-run-demo
DIR="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS="${SECRETS:-/workspace/${NAME}-secrets}"
IMAGE="${SANDCASTLE_IMAGE:-localhost/sandcastle:${NAME}}"
exec 9>"/tmp/${NAME}-loop.lock"
flock -n 9 || { echo "locked: another start is in progress"; exit 0; }
PIDFILE="/tmp/${NAME}-loop.pid"
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "running: pid $(cat "$PIDFILE")"; exit 0
fi
if pgrep -f "${DIR}/.sandcastle/node_modules/.bin/tsx .sandcastle/main.mts" >/dev/null; then
  echo "running: a loop process exists without a pid file"; exit 0
fi
podman image exists "$IMAGE" || { echo "image missing: $IMAGE (check disk before a build)" >&2; exit 1; }
cd "$DIR"
unset GH_TOKEN  # the box GH_TOKEN is invalid
[ -f .sandcastle/.env ] || { echo ".sandcastle/.env is missing" >&2; exit 1; }
if grep -qE '^[[:space:]]*LOOP_WEBHOOK_(URL|KEY)=' .sandcastle/.env; then
  echo "LOOP_WEBHOOK_* must not be in .sandcastle/.env (it would enter containers)" >&2; exit 1
fi
set -a
# shellcheck disable=SC1091
source .sandcastle/.env
set +a
for f in gh-pat loop-webhook-url loop-webhook-key; do
  [ -s "$SECRETS/$f" ] || { echo "secret file missing or empty: $SECRETS/$f" >&2; exit 1; }
done
GH_TOKEN="$(tr -d '\n\r' < "$SECRETS/gh-pat")"
export GH_TOKEN
# Keep GH_TOKEN in .sandcastle/.env equal to the PAT file (containers read that file). Never print it.
python3 - "$SECRETS/gh-pat" .sandcastle/.env <<'PY'
import os, pathlib, sys, tempfile
pat = pathlib.Path(sys.argv[1]).read_text().strip()
path = pathlib.Path(sys.argv[2])
lines = [l for l in path.read_text().splitlines() if not l.startswith("GH_TOKEN=")]
lines.insert(0, "GH_TOKEN=" + pat)
fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".env.")
with os.fdopen(fd, "w") as fh:
    fh.write("\n".join(lines) + "\n")
os.chmod(tmp, 0o600)
os.replace(tmp, path)
PY
LOOP_WEBHOOK_URL="$(tr -d '\n\r' < "$SECRETS/loop-webhook-url")"
LOOP_WEBHOOK_KEY="$(tr -d '\n\r' < "$SECRETS/loop-webhook-key")"
export LOOP_WEBHOOK_URL LOOP_WEBHOOK_KEY
export PROJECT="$NAME" STATUS_FILE="/tmp/${NAME}-loop.status.json" SANDCASTLE_IMAGE="$IMAGE"
export AUTO_MERGE="${AUTO_MERGE:-1}"
[ -x .sandcastle/node_modules/.bin/tsx ] || (cd .sandcastle && npm ci --no-audit --no-fund)
mkdir -p .sandcastle/logs
LOG="$DIR/.sandcastle/logs/loop.log"
echo "=== start $(date -Is) ===" >>"$LOG"
setsid nohup bash -c "cd '$DIR' && exec '$DIR/.sandcastle/node_modules/.bin/tsx' .sandcastle/main.mts" >>"$LOG" 2>&1 9>&- &
echo $! >"$PIDFILE"
sleep 5
kill -0 "$(cat "$PIDFILE")" 2>/dev/null || { echo "the loop stopped at once; read $LOG" >&2; exit 1; }
echo "started: pid $(cat "$PIDFILE") log $LOG"
