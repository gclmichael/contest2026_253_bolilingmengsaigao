#!/usr/bin/env bash

set -euo pipefail

team_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workspace="${1:-${OPENVELA_WORKSPACE:-$(cd "$team_root/.." && pwd)}}"
workspace="$(cd "$workspace" && pwd)"
ai_agent_repo="$workspace/packages/ai_agent"

if [[ ! -d "$ai_agent_repo/.git" ]]; then
  echo "ai_agent repository not found: $ai_agent_repo" >&2
  exit 1
fi

patches=(
  "$team_root/patches/0001-ai_agent-add-quickapp-fast-text-mode.patch"
  "$team_root/patches/0002-ai_agent-bridge-quickapp-voice-input.patch"
)

for patch in "${patches[@]}"; do
  if [[ ! -f "$patch" ]]; then
    echo "Required patch not found: $patch" >&2
    exit 1
  fi
  if git -C "$ai_agent_repo" apply --reverse --check "$patch" >/dev/null 2>&1; then
    echo "Already applied: $(basename "$patch")"
  elif git -C "$ai_agent_repo" apply --check "$patch"; then
    git -C "$ai_agent_repo" apply "$patch"
    echo "Applied: $(basename "$patch")"
  else
    echo "Patch conflicts with the current ai_agent tree: $patch" >&2
    exit 1
  fi
done
