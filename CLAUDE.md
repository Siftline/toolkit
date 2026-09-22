# Siftline toolkit

Bun installs, Node runs, Turborepo orchestrates. Start here, then read `README.md`.

<!-- intent-skills:start -->

## Skill Loading

Before editing files for a substantial task:

- Run `bunx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `bunx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

## Before you hand work back

- `bun run check` at the root MUST pass. It is exactly what CI runs.
- Every published package you touched MUST have a changeset: `bun changeset`.
  Deliberately release-less: `bun changeset --empty`.

## Rules

- Runtime dependencies of published libraries use caret ranges; everything else, the
  `siftline` CLI included, is pinned exactly. Internal dependencies on `@siftline/core`
  use a plain caret range, because Changesets publishes with the npm CLI, which would
  ship a literal `workspace:` protocol. Private packages stay `workspace:*`.
- `@siftline/ui` and `@siftline/config` are consumed just-in-time from source and carry
  only `lint`, `lint:fix` and `typecheck`. Leave the script table uneven.
- Lint with oxlint, format with oxfmt. ESLint and Prettier stay out.
- TypeScript 7 everywhere except `apps/docs`, pinned to 6.0.x for typedoc. Its
  `typecheck` runs on 6 too.
- Run scripts on Node with `bun run`. `bun --bun` breaks Vitest, Vite and wrangler.
- Conventional Commits, signed off: `git commit -s`.

## Agent skills

### Issue tracker

Local markdown under `.scratch/<feature>/`, even though the remote is GitHub. See
`docs/agents/issue-tracker.md`.

### Triage labels

The defaults. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
