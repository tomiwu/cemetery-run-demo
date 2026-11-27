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
# Own podman store (2026-11-27): after the 07:58 box reboot the shared store lost layer data.
# This project uses its own store, so other projects cannot break our image and we cannot
# break theirs. A wrapper in $PODMAN_STORE/bin adds --root/--runroot to every podman call
# of this loop (Sandcastle calls "podman" from PATH). The run root is in /tmp (cleared at boot).
PODMAN_STORE="${PODMAN_STORE:-/workspace/${NAME}-podman}"
if [ "$PODMAN_STORE" != "shared" ]; then
  mkdir -p "$PODMAN_STORE/graph" "$PODMAN_STORE/bin"
  cat > "$PODMAN_STORE/bin/podman" <<EOF
#!/usr/bin/env bash
# ${NAME} only: our own podman store, not the shared one (written by scripts/start-loop.sh).
# Own XDG runtime dir (2026-11-27 14:40): the shared /tmp/xdg-runtime-* dir was recreated and
# lost libpod/tmp/pause.pid, so every rootless podman call failed. Our own dir keeps our pause
# process and crun state apart from other projects.
export XDG_RUNTIME_DIR=/tmp/${NAME}-podman/xdg
mkdir -p "\$XDG_RUNTIME_DIR/libpod/tmp" && chmod 700 "\$XDG_RUNTIME_DIR"
exec /usr/bin/podman --root "$PODMAN_STORE/graph" --runroot /tmp/${NAME}-podman/run --tmpdir /tmp/${NAME}-podman/tmp "\$@"
EOF
  chmod 755 "$PODMAN_STORE/bin/podman"
  export PATH="$PODMAN_STORE/bin:$PATH"
fi
cd "$DIR"
mkdir -p .sandcastle/logs
if ! podman image exists "$IMAGE"; then
  free_gb=$(df -BG --output=avail "$DIR" | tail -1 | tr -dc '0-9')
  [ "${free_gb:-0}" -ge 6 ] || { echo "image missing: $IMAGE and only ${free_gb} GB free" >&2; exit 1; }
  echo "image missing: build $IMAGE from .sandcastle/Containerfile (${free_gb} GB free)"
  podman build -t "$IMAGE" -f .sandcastle/Containerfile .sandcastle >> .sandcastle/logs/image-build.log 2>&1 \
    || { echo "image build failed: see .sandcastle/logs/image-build.log" >&2; exit 1; }
fi
# A box replace can remove .sandcastle/node_modules: install the orchestrator packages again.
[ -x .sandcastle/node_modules/.bin/tsx ] || (cd .sandcastle && npm ci --no-audit --no-fund >/dev/null)
unset GH_TOKEN  # the box GH_TOKEN is invalid
[ -f .sandcastle/.env ] || { echo ".sandcastle/.env is missing" >&2; exit 1; }
if grep -qE '^[[:space:]]*LOOP_WEBHOOK_(URL|KEY)=' .sandcastle/.env; then
  echo "LOOP_WEBHOOK_* must not be in .sandcastle/.env (it would enter containers)" >&2; exit 1
fi
set -a
# shellcheck disable=SC1091
source .sandcastle/.env
set +a
chmod 700 "$SECRETS" 2>/dev/null || true
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
