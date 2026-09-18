# Siftline toolkit

Bun installs, Node runs, Turborepo orchestrates. Start here, then read `README.md`.

## Packages

| Path               | Name                | Published                |
| ------------------ | ------------------- | ------------------------ |
| `packages/core`    | `@siftline/core`    | yes                      |
| `packages/cli`     | `@siftline/cli`     | yes                      |
| `packages/actions` | `@siftline/actions` | yes                      |
| `packages/ui`      | `@siftline/ui`      | no — just-in-time source |
| `packages/config`  | `@siftline/config`  | no — tsconfig bases      |
| `apps/docs`        | `@siftline/docs`    | no — the docs site       |

## Scripts

Every package uses the same names: `build`, `dev`, `lint`, `lint:fix`, `typecheck`,
`test`. Formatting is root-only: `format` and `format:check`.

Before you hand work back, run `bun run check` at the root. It is exactly what CI runs.

## Rules

- Exact version pins everywhere. No carets in `package.json`.
- Anything that changes a published package needs a changeset: `bun changeset`.
  Deliberately release-less? `bun changeset --empty`.
- oxlint and oxfmt only. Never add ESLint or Prettier.
- TypeScript 7 repo-wide. The one allowed `typescript@6.0.x` is `apps/docs`, for typedoc.
- Scripts run on Node, never `bun --bun`.
- Conventional Commits, signed off: `git commit -s`.
