#!/usr/bin/env bash

# PriceRadar one-command local launcher.
# Installs the Node prerequisites/dependencies, starts Vite, waits until it is
# reachable, and opens the app in the user's default browser.

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PORT="${PRICERADAR_PORT:-5173}"
HOST="${PRICERADAR_HOST:-0.0.0.0}"
URL="${PRICERADAR_URL:-http://localhost:${PORT}/}"
LOG_FILE="${PRICERADAR_LOG:-${ROOT_DIR}/.priceradar-dev.log}"
SERVER_PID=""

log() {
  printf '\033[1;32m[PriceRadar]\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33m[PriceRadar]\033[0m %s\n' "$*" >&2
}

fail() {
  printf '\033[1;31m[PriceRadar]\033[0m %s\n' "$*" >&2
  exit 1
}

has_privileged_installer() {
  [[ "$(id -u)" -eq 0 ]] || command -v sudo >/dev/null 2>&1
}

run_privileged() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    return 1
  fi
}

install_node() {
  log "Node.js was not found. Installing the Node.js prerequisite..."

  if command -v brew >/dev/null 2>&1; then
    brew install node
  elif command -v apt-get >/dev/null 2>&1 && has_privileged_installer; then
    run_privileged apt-get update
    run_privileged apt-get install -y nodejs npm
  elif command -v dnf >/dev/null 2>&1 && has_privileged_installer; then
    run_privileged dnf install -y nodejs npm
  elif command -v pacman >/dev/null 2>&1 && has_privileged_installer; then
    run_privileged pacman -Sy --noconfirm nodejs npm
  else
    fail "Node.js 18+ is required. Install it from https://nodejs.org/ and run this script again."
  fi
}

ensure_prerequisites() {
  if ! command -v node >/dev/null 2>&1; then
    install_node
  fi

  command -v node >/dev/null 2>&1 || fail "Node.js installation did not complete."
  command -v npm >/dev/null 2>&1 || fail "npm was not found. Reinstall Node.js from https://nodejs.org/."

  local node_major
  node_major="$(node -p "process.versions.node.split('.')[0]")"
  if (( node_major < 18 )); then
    fail "PriceRadar requires Node.js 18 or newer; found $(node --version)."
  fi

  log "Using Node $(node --version) and npm $(npm --version)"
}

choose_port() {
  # If the default port is busy, avoid killing another application. Vite will
  # also choose a port automatically, but selecting it here keeps the browser
  # URL deterministic.
  if command -v lsof >/dev/null 2>&1; then
    while lsof -iTCP:"${PORT}" -sTCP:LISTEN -t >/dev/null 2>&1; do
      warn "Port ${PORT} is already in use; trying $((PORT + 1))."
      PORT=$((PORT + 1))
      URL="${PRICERADAR_URL:-http://localhost:${PORT}/}"
    done
  fi
}

wait_for_server() {
  local attempt
  for attempt in {1..60}; do
    if command -v curl >/dev/null 2>&1; then
      if curl --silent --fail --max-time 1 "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
        return 0
      fi
    elif command -v nc >/dev/null 2>&1; then
      if nc -z 127.0.0.1 "${PORT}" >/dev/null 2>&1; then
        return 0
      fi
    else
      # curl/nc are only used as readiness checks; give Vite a short startup
      # window when neither utility exists.
      sleep 2
      return 0
    fi

    if [[ -n "${SERVER_PID}" ]] && ! kill -0 "${SERVER_PID}" 2>/dev/null; then
      warn "The UI server stopped unexpectedly. Last log lines:"
      tail -n 30 "$LOG_FILE" >&2 || true
      return 1
    fi
    sleep 1
  done
  return 1
}

open_browser() {
  local browser_command="${BROWSER:-}"

  if [[ -n "$browser_command" ]]; then
    "$browser_command" "$URL" >/dev/null 2>&1 &
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 &
  elif command -v cmd.exe >/dev/null 2>&1; then
    cmd.exe /c start "" "$URL" >/dev/null 2>&1 &
  elif command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "Start-Process '$URL'" >/dev/null 2>&1 &
  else
    warn "No desktop browser opener was detected. Open this URL manually: $URL"
    return 0
  fi

  log "Opened $URL in your default browser."
}

cleanup() {
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    log "Stopping the PriceRadar development server..."
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

ensure_prerequisites
choose_port

log "Installing project dependencies..."
npm install --no-audit --no-fund

log "Starting the PriceRadar UI on port ${PORT}..."
# Keep the server in the foreground from this script's perspective so Ctrl+C
# cleanly stops it and the child process is not orphaned.
npm run dev -- --host "${HOST}" --port "${PORT}" >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

if ! wait_for_server; then
  tail -n 40 "$LOG_FILE" >&2 || true
  fail "The UI server did not become ready. See ${LOG_FILE} for details."
fi

log "PriceRadar is ready."
open_browser
log "Press Ctrl+C to stop the server."

wait "${SERVER_PID}"
