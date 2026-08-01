#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <material.txt|material.md>" >&2
  exit 2
fi

source_file="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
agent_data_dir="${FOCUSLOOP_AGENT_DATA_DIR:-/data/ai_agent}"
max_bytes=$((64 * 1024))

if [[ ! -f "$source_file" ]]; then
  echo "Material file not found: $source_file" >&2
  exit 1
fi

case "${source_file##*.}" in
  txt|md|TXT|MD) ;;
  *) echo "Only .txt and .md learning materials are supported." >&2; exit 1 ;;
esac

size="$(wc -c < "$source_file")"
if (( size == 0 || size > max_bytes )); then
  echo "Material must be between 1 byte and 64 KB (actual: $size bytes)." >&2
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb is required and was not found in PATH." >&2
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
mkdir -p "$tmp_dir/focusloop"
cp "$source_file" "$tmp_dir/focusloop/import.txt"
"${adb_cmd[@]}" push "$tmp_dir/focusloop" "$agent_data_dir/"

echo "Learning material imported locally. Open FocusLoop and choose '导入材料'."
