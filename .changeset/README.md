# Changesets

This directory is the release queue. Every `.md` file here is one unreleased change,
written by a human, consumed by [Changesets](https://github.com/changesets/changesets).

## Adding one

```sh
bun changeset
```

Pick the published packages the change affects (`@siftline/core`, `@siftline/cli`,
`@siftline/actions` — the private ones are ignored), pick major/minor/patch, and write the
line a consumer would want to read in the changelog. Commit the generated file with your
change.

## The escape hatch

CI runs `bun changeset status --since=origin/main` and fails a pull request that touches a
published package without a changeset. When a change genuinely needs no release — a test,
a comment, an internal refactor — record that deliberately:

```sh
bun changeset --empty
```

That writes a changeset with no version bumps, which satisfies the gate and leaves a trace
of the decision in the diff. Skipping the step is not an option; saying "no release" is.

## What happens next

On `main`, `release.yml` runs `changesets/action`. It opens (or updates) a **Version
Packages** pull request that consumes every changeset here, bumps versions and writes the
changelogs. Merging that pull request publishes to npm through trusted publishing — no
token, provenance attached. See the maintainer section of the root
[README](../README.md#releases-maintainers).

Versions move independently: nothing here is `linked` or `fixed`. Bumping `@siftline/core`
gives `@siftline/cli` and `@siftline/actions` a patch with their caret range on core
updated.
