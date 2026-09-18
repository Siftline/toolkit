# Siftline toolkit

The open-source half of [Siftline](https://siftline.dev) — sort incoming text into your
categories, then act on it.

This repo holds the published packages and the documentation site. The hosted app lives
elsewhere and is not open source.

| Package             | What it is                                                        |
| ------------------- | ----------------------------------------------------------------- |
| `@siftline/core`    | The engine: recipes, rules, fixtures, and the judge wrapper.      |
| `@siftline/cli`     | `siftline` — run a recipe against fixtures from the terminal.     |
| `@siftline/actions` | Adapters that carry a decision somewhere (webhook, Slack, email). |

`@siftline/ui` and `@siftline/config` are private: they are consumed just-in-time from
source inside this repo and are never published.

Nothing is released yet. Docs will live at [docs.siftline.dev](https://docs.siftline.dev).

## Getting started

```sh
bun install
bun run check
```

Bun 1.4.2 installs; **Node 24 runs everything**. No script is run with `bun --bun`:
Vitest, Vite and wrangler are only supported on Node. `.node-version` pins the runtime
and `packageManager` pins the installer, so CI and your machine agree.

`bun install` needs no lifecycle scripts: `bun pm untrusted` reports zero untrusted
dependencies, so there is no `trustedDependencies` list in the root `package.json`. If a
future dependency needs one, add it there and say so here.

## Scripts

`bun run check` is the whole gate, and it is exactly what CI runs:

```sh
bun run check   # turbo run build lint typecheck test format:check
```

Every package exposes the same names, so you never have to look one up:

| Script      | What it does                                                   |
| ----------- | -------------------------------------------------------------- |
| `build`     | Bundle with tsdown; `apps/docs` prerenders to `.output`.       |
| `dev`       | Watch mode.                                                    |
| `lint`      | `oxlint --type-aware --deny-warnings`.                         |
| `lint:fix`  | The same, with `--fix`.                                        |
| `typecheck` | `tsc --noEmit` — the TypeScript 7 (Go) compiler.               |
| `test`      | Vitest, colocated `src/**/*.test.ts`, no globals, no coverage. |

Formatting is root-only, because there is one config for the repo:

```sh
bun run format         # oxfmt, writes
bun run format:check   # oxfmt --check, what `check` runs
```

`packages/core` also has `test:live`, which talks to the real TypeSafe API. It skips
itself when `TYPESAFE_API_KEY` is absent, Turborepo never runs it, and in CI it runs only
through the manually dispatched `live.yml`.

oxlint and oxfmt are the only lint and format tools here. ESLint and Prettier do not
enter this repo. Install the [oxc VS Code
extension](https://marketplace.visualstudio.com/items?itemName=oxc.oxc-vscode) and
`.vscode/settings.json` gives you fix-and-format on save, so formatting never becomes a
commit.

## Documentation site

`apps/docs` builds the site behind [docs.siftline.dev](https://docs.siftline.dev): Fumadocs
on TanStack Start, prerendered to static HTML and served by Cloudflare as static assets with
no Worker code at all. [`apps/docs/README.md`](./apps/docs/README.md) covers the static
build, the Cloudflare asset config, and the SSR escape hatch if the docs ever need a server.

## TypeScript version rule (ADR 0004)

**TypeScript 7 is the baseline repo-wide.** It ships the Go compiler, which is what
`typecheck` runs and what emits every published `.d.mts` — `packages/core` pins tsdown's
declaration generator to `tsgo` explicitly rather than letting it be chosen from install
state.

TypeScript 7 ships **no JavaScript compiler API**, so a tool that imports one cannot run
on it. The single permitted escape hatch: a package **may pin `typescript@6.0.x` exact as
a `devDependency`, and only when a tool it runs imports the compiler API**. The pin must
carry a comment naming that tool. Today that is exactly one package — `apps/docs`, for
typedoc. The pin is devDependency-only: it may never appear in a published package's
`dependencies`, and it never emits types. Every `typescript` entry in a `package.json` is
therefore a declared, greppable escape hatch rather than drift.

`build` and `typecheck` are siblings, never a chain: declarations are emitted with
`--noCheck`, so a green `build` is not a typecheck. `bun run check` and CI cover both.

## Changesets

Anything that changes a published package needs a changeset:

```sh
bun changeset
```

Pick the packages, pick the bump, write the line a consumer would want to read. If a
change genuinely needs no release, record that deliberately with `bun changeset --empty`
rather than skipping the step — CI fails a PR that touches a published package without
one.

Versions move independently — nothing is `linked` or `fixed`. A bump to `@siftline/core`
gives `@siftline/cli` and `@siftline/actions` a patch with their caret range on core
updated for them. `@siftline/docs`, `@siftline/ui` and `@siftline/config` are private and
ignored. [`.changeset/README.md`](./.changeset/README.md) has the details.

## Releases (maintainers)

Releases are automatic and tokenless. `release.yml` runs after CI succeeds on `main` and
does one of two things:

1. **Changesets are queued** — it opens or updates a **Version Packages** pull request
   that consumes them, bumps versions and writes the changelogs.
2. **No changesets are left** (that pull request just landed) — it packs the tarballs and
   publishes them to npm.

Publishing uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers): the
publish job is the only one with `id-token: write`, npm exchanges that OIDC token for
short-lived credentials and attaches provenance. There is no `NPM_TOKEN` in this repo and
`registry-url` is deliberately not passed to `actions/setup-node` — it would write an
`.npmrc` that puts npm back on the token path and silently drops provenance.

One repository setting is required for step 1: **Settings → Actions → General → Allow
GitHub Actions to create and approve pull requests** must be on, or the version job fails.

### First publish (one time, by a human)

Trusted publishers can only be attached to a package that already exists on npm, so the
very first release of each package is manual. From a clean `main` checkout on Node 24,
logged in to npm as a maintainer with 2FA:

```sh
npm view @siftline/core            # confirm the 24h post-deletion block has lapsed
bun ci
bun run build
cd packages/core    && npm publish --access public --otp <code> && cd -   # 0.0.2
cd packages/cli     && npm publish --access public --otp <code> && cd -   # 0.0.1
cd packages/actions && npm publish --access public --otp <code> && cd -   # 0.0.1
```

Pass `--otp` on the command line: Changesets strips `NPM_CONFIG_OTP` from the environment,
and these publishes are local, so there is no OIDC and therefore **no provenance** on this
first set of tarballs. That is expected — provenance starts with the first `release.yml`
publish.

Then, on npmjs.com for **each** of the three packages: Settings → Trusted publisher →
GitHub Actions, with

| Field                | Value         |
| -------------------- | ------------- |
| Organization or user | `Siftline`    |
| Repository           | `toolkit`     |
| Workflow filename    | `release.yml` |
| Environment          | _leave blank_ |

Leave the environment blank. The publish job declares no `environment:`, and a name here
would make the OIDC claim fail to match.

Until those publishers exist, `release.yml` is expected to reach the publish step and
**fail there**. That is the documented state between the release wiring landing and this
procedure being run; nothing else in the workflow is wrong. Afterwards, re-run
`release.yml` (or merge an empty changeset) and confirm the packages show a provenance
badge on npm.

## Contributing

Issues are open. Pull requests are welcome under the
[Developer Certificate of Origin](https://developercertificate.org/) — sign off your
commits with `git commit -s`. There is no CLA.

Commit messages and squash-merge titles follow
[Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `chore`,
`docs`, `test`, `refactor`, `ci`, `research`.

## Licence

MIT — see [LICENSE](./LICENSE). "Siftline" is a project name, not a licence grant: forks
are free, the name is not.
