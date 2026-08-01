#!/usr/bin/env bash

set -euo pipefail

team_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workspace="${1:-${OPENVELA_WORKSPACE:-$(cd "$team_root/.." && pwd)}}"
workspace="$(cd "$workspace" && pwd)"
board="vendor/openvela/boards/vela/configs/goldfish-arm64-v8a-ap"
source_defconfig="$workspace/packages/ai_agent/defconfigs/goldfish-arm64-v8a-ap/goldfish-arm64-v8a-ap_defconfig"
target_defconfig="$workspace/$board/defconfig"
build_dir="$workspace/cmake_out/vela_goldfish-arm64-v8a-ap"
jobs="${FOCUSLOOP_BUILD_JOBS:-$(nproc)}"

if [[ ! -x "$workspace/build.sh" ]]; then
  echo "Not an openvela workspace: $workspace" >&2
  exit 1
fi

if [[ ! -f "$source_defconfig" ]]; then
  echo "ai_agent Goldfish defconfig not found: $source_defconfig" >&2
  exit 1
fi

"$team_root/scripts/apply_openvela_patches.sh" "$workspace"

install -D -m 0644 "$source_defconfig" "$target_defconfig"

case "$build_dir" in
  "$workspace"/cmake_out/vela_goldfish-arm64-v8a-ap) ;;
  *) echo "Refusing unexpected build directory: $build_dir" >&2; exit 1 ;;
esac

rm -rf -- "$build_dir"
cd "$workspace"
./build.sh "$board" --cmake "-j$jobs"

echo "Goldfish AI build completed: $build_dir"
echo "Run: ./emulator.sh $build_dir/"
