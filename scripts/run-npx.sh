#!/usr/bin/env bash

# run-npx.sh: run npx when registry is reachable, otherwise skip quickly.
# This keeps developer workflows fast in offline environments while still
# executing the real npx command in CI or on machines with network access.

set -euo pipefail

if [ "$#" -eq 0 ]; then
    echo "Usage: run-npx.sh <args...>" >&2
    exit 1
fi

# Hooks force color (FORCE_COLOR=1); a user-level NO_COLOR would make node
# print a warning per spawned process, so it yields when color is forced.
if [ -n "${FORCE_COLOR:-}" ]; then
    unset NO_COLOR
fi

# Fast path: execute locally installed node_modules/.bin/<tool> directly when
# no explicit -p/--package version pin is requested and FORCE_NPX!=1. This
# skips both the live TCP registry probe and npx wrapper startup.
if [ "${FORCE_NPX:-0}" != "1" ]; then
    _first="$1"
    _shift=1
    if [ "$_first" = "-y" ] || [ "$_first" = "--yes" ]; then
        if [ "$#" -ge 2 ]; then
            _first="$2"
            _shift=2
        fi
    fi
    case "$_first" in
        -*|*/*|*@*) ;;
        *)
            if [ -x "./node_modules/.bin/$_first" ]; then
                shift "$_shift"
                exec "./node_modules/.bin/$_first" "$@"
            fi
            ;;
    esac
fi

if ! command -v npx >/dev/null 2>&1; then
    echo "npx is not available; skipping: npx $*" >&2
    exit 0
fi

if [ "${FORCE_NPX:-0}" = "1" ]; then
    exec npx --loglevel=error "$@"
fi

HOST=${NPM_REGISTRY_HOST:-registry.npmjs.org}
PORT=${NPM_REGISTRY_PORT:-443}
TIMEOUT=${NPM_REGISTRY_TIMEOUT:-3}

python3 - "$HOST" "$PORT" "$TIMEOUT" <<'PY'
import socket
import sys

host, port, timeout = sys.argv[1], int(sys.argv[2]), float(sys.argv[3])

try:
    sock = socket.create_connection((host, port), timeout=timeout)
except OSError:
    sys.exit(1)
else:
    sock.close()
PY

if [ "$?" -ne 0 ]; then
    echo "Skipping 'npx $*' (cannot reach ${HOST}:${PORT}). Set FORCE_NPX=1 to override." >&2
    exit 0
fi

exec npx --loglevel=error "$@"
