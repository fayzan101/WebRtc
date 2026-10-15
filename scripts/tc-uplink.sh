#!/usr/bin/env bash
# Phase 7 — Linux traffic-control helper for capped-uplink experiments.
# Caps EGRESS (uplink) on an interface via TBF.
#
# Usage:
#   sudo ./scripts/tc-uplink.sh apply <iface> <rate>   # e.g. eth0 1mbit
#   sudo ./scripts/tc-uplink.sh clear <iface>
#   ./scripts/tc-uplink.sh show <iface>
#
# Rates: 1mbit | 5mbit (or any `tc` rate string)
set -euo pipefail

TC_BIN="${TC_BIN:-tc}"
BURST="${TC_BURST:-32kbit}"
LATENCY="${TC_LATENCY:-400ms}"

usage() {
  cat <<'EOF'
Usage:
  tc-uplink.sh apply <iface> <rate>
  tc-uplink.sh clear <iface>
  tc-uplink.sh show <iface>

Examples:
  sudo ./scripts/tc-uplink.sh apply eth0 1mbit
  sudo ./scripts/tc-uplink.sh apply eth0 5mbit
  sudo ./scripts/tc-uplink.sh clear eth0
  ./scripts/tc-uplink.sh show eth0
EOF
}

run_tc() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$TC_BIN" "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$TC_BIN" "$@"
  else
    echo "error: root or sudo required to modify qdisc" >&2
    exit 1
  fi
}

clear_root() {
  local iface="$1"
  # Idempotent: ignore "No such file or directory" / missing qdisc
  run_tc qdisc del dev "$iface" root 2>/dev/null || true
}

cmd="${1:-}"
iface="${2:-}"
rate="${3:-}"

case "$cmd" in
  apply)
    if [[ -z "$iface" || -z "$rate" ]]; then
      usage
      exit 1
    fi
    clear_root "$iface"
    run_tc qdisc add dev "$iface" root tbf rate "$rate" burst "$BURST" latency "$LATENCY"
    echo "applied tbf rate=$rate on $iface"
    run_tc qdisc show dev "$iface"
    ;;
  clear)
    if [[ -z "$iface" ]]; then
      usage
      exit 1
    fi
    clear_root "$iface"
    echo "cleared root qdisc on $iface"
    ;;
  show)
    if [[ -z "$iface" ]]; then
      usage
      exit 1
    fi
    # show does not require write privileges when possible
    if [[ "$(id -u)" -eq 0 ]] || ! command -v sudo >/dev/null 2>&1; then
      "$TC_BIN" qdisc show dev "$iface"
    else
      "$TC_BIN" qdisc show dev "$iface" 2>/dev/null || sudo "$TC_BIN" qdisc show dev "$iface"
    fi
    ;;
  -h|--help|help|"")
    usage
    ;;
  *)
    echo "error: unknown command: $cmd" >&2
    usage
    exit 1
    ;;
esac
