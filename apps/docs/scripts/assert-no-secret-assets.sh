#!/usr/bin/env bash
#
# Refuse to deploy when a secret could be served publicly.
#
# Runs against the built assets directory, never `wrangler deploy --dry-run --outdir`:
# that outdir holds the Worker script alone and no asset ever lands there, so grepping it
# would always pass and prove nothing.
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

# A while loop rather than `mapfile`, so this also runs on the bash 3.2 macOS ships.
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
