# Vendored anti-slop

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), commit
`e6676e8d0bf17c678cb45b9dacb2bd6ca8dea53a`, directory `skills/install-anti-slop/assets/anti-slop/`.

All 38 files are byte-identical to that commit. Verified by comparing `git hash-object` of each
copied file against the upstream tree.

## Installed plugins

- `anti-slop`: `tools/oxlint/anti-slop/index.ts`. Registered in the root `.oxlintrc.json`. Every
  generic rule runs at `error`, alongside the native `oxc/no-accumulating-spread`.
- `anti-slop-effect`: `tools/oxlint/anti-slop/effect/index.ts`. Copied but not registered. No
  package declares `effect` directly.

`vendor/eslint-stylistic/` keeps its own `LICENSE` and `UPSTREAM.md`.

## Dependencies

`@oxlint/plugins` is pinned to the root `oxlint` version, currently `1.83.0`. Upgrade the two
together.

## Local deviations

None to the vendored files. Repository wiring:

- `.oxlintrc.json` and `.oxfmtrc.json` ignore this directory and agent tooling directories.
- `turbo.json` adds this directory to the `lint` task inputs, so rule changes invalidate the cache.
