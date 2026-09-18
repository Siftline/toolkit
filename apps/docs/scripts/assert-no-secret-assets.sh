#!/usr/bin/env bash
#
# Every file in the assets directory is uploaded to Cloudflare and served publicly. Only
# `.assetsignore`, `_headers` and `_redirects` are excluded by default — nothing else is
# implicitly safe, and wrangler prints no warning when it uploads a secret.
#
# This runs against the built assets directory, not against `wrangler deploy --dry-run
# --outdir <dir>`. The outdir is esbuild's output for the Worker script alone: for an
# assets-only Worker it contains exactly `no-op-worker.js`, its source map and a one-line
# README, and asset upload is gated on `!dryRun`, so no asset ever lands there. Grepping
# it for a stray secret would always pass and prove nothing.
#
# Usage: assert-no-secret-assets.sh [assets-directory]   (default: .output/public)

set -euo pipefail

assets="${1:-.output/public}"

if [[ ! -d "$assets" ]]; then
  echo "::error::assets directory '$assets' does not exist — run the build first" >&2
  exit 1
fi

# (1) Default deny. `.assetsignore` is read from the root of the *assets* directory and
# nowhere else; a copy left at the package root is silently ignored. It is the only thing
# covering names this script does not know to look for.
if [[ ! -f "$assets/.assetsignore" ]]; then
  echo "::error::$assets/.assetsignore is missing — the build dropped it, and every file below would be uploaded" >&2
  exit 1
fi

for pattern in wrangler.json .dev.vars; do
  if ! grep -qxF -- "$pattern" "$assets/.assetsignore"; then
    echo "::error::$assets/.assetsignore no longer lists '$pattern'" >&2
    exit 1
  fi
done

# (2) Belt as well as braces. A secret-shaped file has no business in the build output at
# all, whether or not `.assetsignore` happens to cover it today.
strays=$(
  find "$assets" \
    \( -name '.dev.vars' -o -name '.dev.vars.*' \
    -o -name '.env' -o -name '.env.*' \
    -o -name 'wrangler.json' -o -name 'wrangler.jsonc' -o -name 'wrangler.toml' \) \
    -print
)

if [[ -n "$strays" ]]; then
  echo "::error::secret-shaped files in the asset output — these would be uploaded to Cloudflare:" >&2
  echo "$strays" >&2
  exit 1
fi

echo "assets ok: $assets/.assetsignore is in place and no secret-shaped file reached the output"
