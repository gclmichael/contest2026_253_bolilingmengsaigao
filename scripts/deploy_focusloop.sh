#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
rpk="${FOCUSLOOP_RPK:-$repo_root/quickapp/focusloop/dist/com.openvela.focusloop.debug.0.1.0.rpk}"
skill="$repo_root/agent_skills/focusloop.md"
agent_data_dir="${FOCUSLOOP_AGENT_DATA_DIR:-/data/ai_agent}"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb is required and was not found in PATH." >&2
  exit 1
fi

if [[ ! -f "$rpk" ]]; then
  echo "RPK not found: $rpk" >&2
  echo "Run npm install && npm run build in quickapp/focusloop first." >&2
  exit 1
fi

adb_cmd=(adb)
if [[ -n "${ADB_SERVER_PORT:-}" ]]; then
  adb_cmd+=( -P "$ADB_SERVER_PORT" )
fi
if [[ -n "${ADB_SERIAL:-}" ]]; then
  adb_cmd+=( -s "$ADB_SERIAL" )
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
mkdir -p "$tmp_dir/app"
unzip -q -o "$rpk" -d "$tmp_dir/app"

shopt -s dotglob nullglob
for entry in "$tmp_dir/app/"*; do
  "${adb_cmd[@]}" push "$entry" /data/app/com.openvela.focusloop/
done
"${adb_cmd[@]}" push "$skill" "$agent_data_dir/skills/review-scheduler.md"

if [[ -n "${OPENVELA_WORKSPACE:-}" ]]; then
  font_dir="$OPENVELA_WORKSPACE/vendor/openvela/boards/vela/resource/font"
  for font in MiSans-Regular.ttf MiSans-Demibold.ttf; do
    if [[ ! -f "$font_dir/$font" ]]; then
      echo "Font not found: $font_dir/$font" >&2
      exit 1
    fi
    "${adb_cmd[@]}" push "$font_dir/$font" "/data/font/$font"
  done
  echo "Goldfish fonts deployed from: $font_dir"
fi

echo "FocusLoop app and Agent Skill deployed locally."
echo "Agent data directory: $agent_data_dir"
echo "If the Skill path is missing, start ai_agent once and run this script again."
