# Siftline toolkit

pnpm installs, Node runs, Turborepo orchestrates. Start here, then read `README.md`.

<!-- intent-skills:start -->

## Skill Loading

Before editing files for a substantial task:

- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

## Before you hand work back

- `pnpm run check` at the root MUST pass. It is exactly what CI runs.
- Every published package you touched MUST have a changeset: `pnpm changeset`.
  Deliberately release-less: `pnpm changeset --empty`.

## Rules

- Runtime dependencies of published libraries MUST use caret ranges. Everything else, the
  `siftline` CLI included, MUST be pinned exactly. Internal dependencies on `@siftline/core`
  use a plain caret range, because Changesets publishes with the npm CLI, which would
  ship a literal `workspace:` protocol. Private packages stay `workspace:*`.
- `@siftline/ui` and `@siftline/config` are consumed just-in-time from source and carry
  only `lint`, `lint:fix` and `typecheck`. Leave the script table uneven.
- Lint with oxlint, format with oxfmt, both through Vite+ (`vp lint`, `vp fmt`) and the
  root `vite.config.ts`. ESLint and Prettier stay out.
- TypeScript 7 everywhere except `apps/docs`, pinned to 6.0.x for typedoc. Its
  `typecheck` runs on 6 too.
- Run scripts with `pnpm run`.
- Conventional Commits, signed off: `git commit -s`.

## Agent skills

### Issue tracker

Local markdown under `.scratch/<feature>/`, even though the remote is GitHub. See
`docs/agents/issue-tracker.md`.

### Triage labels

The defaults. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
