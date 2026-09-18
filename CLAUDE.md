# Siftline toolkit

Bun installs, Node runs, Turborepo orchestrates. Start here, then read `README.md`.

## Packages

| Path               | Name                | Published                |
| ------------------ | ------------------- | ------------------------ |
| `packages/core`    | `@siftline/core`    | yes                      |
| `packages/cli`     | `@siftline/cli`     | yes                      |
| `packages/actions` | `@siftline/actions` | yes                      |
| `packages/ui`      | `@siftline/ui`      | no — just-in-time source |
| `packages/config`  | `@siftline/config`  | no — shared build config |
| `apps/docs`        | `@siftline/docs`    | no — the docs site       |

## Scripts

The three published packages and `apps/docs` use the same names: `build`, `dev`, `lint`,
`lint:fix`, `typecheck`, `test`. Formatting is root-only: `format` and `format:check`.

`@siftline/ui` and `@siftline/config` are the exception, on purpose. They are consumed
just-in-time from source, so there is nothing to bundle, nothing to watch and nothing to
test; they carry only `lint`, `lint:fix` and `typecheck`. Do not add no-op scripts to make
the table look even.

Before you hand work back, run `bun run check` at the root. It is exactly what CI runs.

## Rules

- Exact version pins for everything that comes from a registry — `bunfig.toml` sets
  `exact = true`. Carets are for internal dependencies only: `@siftline/cli` and
  `@siftline/actions` depend on `@siftline/core` through a plain caret range (`^0.0.2`)
  because Changesets publishes with the npm CLI, which would ship a literal `workspace:`
  protocol to npm. The private packages are consumed as `workspace:*` and never reach a
  registry at all.
- Anything that changes a published package needs a changeset: `bun changeset`.
  Deliberately release-less? `bun changeset --empty`.
- oxlint and oxfmt only. Never add ESLint or Prettier.
- TypeScript 7 repo-wide. The one allowed `typescript@6.0.x` is `apps/docs`, for typedoc —
  and because that pin is the nearest `typescript` to the docs app, its `typecheck` runs on
  6.0.3 too. Nothing under `apps/docs` is covered by TypeScript 7 semantics.
- Scripts run on Node, never `bun --bun`.
- Conventional Commits, signed off: `git commit -s`.
