#!/usr/bin/env bash
#
# Refuse to deploy when a secret could be served publicly.
#
# Every file in the assets directory is uploaded to Cloudflare and served publicly. Only
# `.assetsignore`, `_headers` and `_redirects` are excluded by default.
#
# `public/.assetsignore` is the single source of truth for what must not be uploaded. This
# script reads it — it restates no pattern of its own — and then asserts three things:
#
#   1. the tracked list is present and lists at least one pattern;
#   2. the copy that reached the assets directory is byte-identical to it, because a
#      dropped or mangled `.assetsignore` means wrangler's own filter is gone;
#   3. nothing matching a pattern in that list is actually sitting in the output, which is
#      belt as well as braces: `.assetsignore` stops the upload, this stops the file from
#      ever being built into the directory in the first place.
#
# This runs against the built assets directory, not against `wrangler deploy --dry-run
# --outdir <dir>`. The outdir is esbuild's output for the Worker script alone: for an
# assets-only Worker it contains exactly `no-op-worker.js`, its source map and a one-line
# README, and asset upload is gated on `!dryRun`, so no asset ever lands there. Grepping
# it for a stray secret would always pass and prove nothing.
#
# Usage: assert-no-secret-assets.sh [assets-directory]   (default: .output/public)

set -euo pipefail

app_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
tracked_ignore="$app_dir/public/.assetsignore"

assets="${1:-.output/public}"
shipped_ignore="$assets/.assetsignore"

fail() {
  echo "::error::$1" >&2
  exit 1
}

[[ -d "$assets" ]] || fail "assets directory '$assets' does not exist — run the build first"
[[ -f "$tracked_ignore" ]] || fail "'$tracked_ignore' is missing — there is no list to enforce"

# The list, minus comments and blank lines. Read with a while loop rather than `mapfile`
# so this also runs on the bash 3.2 that ships with macOS.
patterns=()
while IFS= read -r pattern; do
  patterns+=("$pattern")
done < <(grep -v -e '^[[:space:]]*#' -e '^[[:space:]]*$' "$tracked_ignore" || true)

if [[ ${#patterns[@]} -eq 0 ]]; then
  fail "'$tracked_ignore' lists no patterns — every file below '$assets' would be uploaded"
fi

[[ -f "$shipped_ignore" ]] ||
  fail "$shipped_ignore is missing — the build dropped it, and every file below would be uploaded"

cmp -s "$tracked_ignore" "$shipped_ignore" ||
  fail "$shipped_ignore differs from the tracked $tracked_ignore — the build mangled the list"

# One `find` expression built from the same patterns: `-name` takes the glob as written.
find_expression=()
for pattern in "${patterns[@]}"; do
  if [[ ${#find_expression[@]} -gt 0 ]]; then
    find_expression+=(-o)
  fi
  find_expression+=(-name "$pattern")
done

strays=$(find "$assets" \( "${find_expression[@]}" \) -print)

if [[ -n "$strays" ]]; then
  echo "::error::secret-shaped files in the asset output — these would be uploaded to Cloudflare:" >&2
  echo "$strays" >&2
  exit 1
fi

echo "assets ok: $shipped_ignore matches the tracked list (${#patterns[@]} patterns) and nothing in '$assets' matches it"
