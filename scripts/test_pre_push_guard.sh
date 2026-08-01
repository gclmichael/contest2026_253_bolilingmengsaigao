#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
hook="$repo_root/.githooks/pre-push"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

git init -q "$tmp_dir/repo"
cd "$tmp_dir/repo"
git config user.name focusloop-test
git config user.email focusloop-test@example.invalid

printf 'base\n' > README.md
git add README.md
git commit -q -m base
base_sha="$(git rev-parse HEAD)"
git update-ref refs/remotes/origin/dev-ai-contest-2026 "$base_sha"

mkdir logs
printf '{"private":true}\n' > logs/session.jsonl
git add logs/session.jsonl
git commit -q -m add-log
rm logs/session.jsonl
git add -u
git commit -q -m remove-log
tip_sha="$(git rev-parse HEAD)"
zero_sha="0000000000000000000000000000000000000000"

if printf 'refs/heads/topic %s refs/heads/topic %s\n' "$tip_sha" "$zero_sha" \
  | "$hook" origin local; then
  echo "guard failed to block a log hidden in commit history" >&2
  exit 1
fi

approval_file="$(git rev-parse --git-path ai-log-upload-approved-sha)"
printf '%s\n' "$tip_sha" > "$approval_file"
printf 'refs/heads/topic %s refs/heads/topic %s\n' "$tip_sha" "$zero_sha" \
  | "$hook" origin local

if [[ -f "$approval_file" ]]; then
  echo "guard failed to consume one-time approval" >&2
  exit 1
fi

echo "pre-push privacy guard tests passed"
