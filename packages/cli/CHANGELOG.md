# @siftline/cli

## 0.1.2

### Patch Changes

- [#13](https://github.com/Siftline/toolkit/pull/13) [`85c52a1`](https://github.com/Siftline/toolkit/commit/85c52a1d5cb178e47129c3d25f1c50b7a40ea5a8) Thanks [@l0st0](https://github.com/l0st0)! - Build against `@siftline/core` 0.2.0, with no behaviour change.
- Updated dependencies [[`85c52a1`](https://github.com/Siftline/toolkit/commit/85c52a1d5cb178e47129c3d25f1c50b7a40ea5a8), [`85c52a1`](https://github.com/Siftline/toolkit/commit/85c52a1d5cb178e47129c3d25f1c50b7a40ea5a8), [`85c52a1`](https://github.com/Siftline/toolkit/commit/85c52a1d5cb178e47129c3d25f1c50b7a40ea5a8), [`85c52a1`](https://github.com/Siftline/toolkit/commit/85c52a1d5cb178e47129c3d25f1c50b7a40ea5a8)]:
  - @siftline/core@0.2.0

## 0.1.1

### Patch Changes

- [#11](https://github.com/Siftline/toolkit/pull/11) [`478f62b`](https://github.com/Siftline/toolkit/commit/478f62be97853a1a3ba3bb4614f1a1096e65aeb2) Thanks [@l0st0](https://github.com/l0st0)! - Decode thrown SDK errors and CLI validation issues with Zod schemas instead of `typeof` checks. `createReplayClient` now matches a request by its JSON form, so a member set to `undefined` no longer blocks a match. `@siftline/cli` depends on `zod` directly.
- Updated dependencies [[`478f62b`](https://github.com/Siftline/toolkit/commit/478f62be97853a1a3ba3bb4614f1a1096e65aeb2)]:
  - @siftline/core@0.1.1

## 0.1.0

### Minor Changes

- [#8](https://github.com/Siftline/toolkit/pull/8) [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81) Thanks [@l0st0](https://github.com/l0st0)! - Add `siftline label`, which judges real Records and writes Decisions.

  `siftline label <recipe.json> [records.jsonl | -]` reads JSONL Records from a file or, with `-`
  or no second positional, from stdin. Every line is parsed as a strict Record
  `{ id, state, trimmed? }` before the first call, so a bad line exits 2 naming its 1-based number
  with no request made. `trimmed` reaches the Decision untouched.

  stdout carries exactly one `serializeDecision` line per Record in input order, held in a reorder
  buffer over the `--max-in-flight` gate, whatever order the model answers in. Progress on stderr
  is a `12/240` counter, rewritten in place on a TTY and one line per 50 otherwise, silenced by
  `--quiet`.

  `--rules <rules.json>` parses one JSON array through `ruleSchema`, exits 2 on any problem
  `validateRules` reports, then routes each Decision with `routeDecision`. Without it `rule` and
  `action` stay null. `label` refuses `--json` and `--min-accuracy`.

  A `JudgeError` on one Record writes `<id>: <reason>` to stderr — "state over the token budget"
  for `max_tokens_exceeded` — skips that Record and leaves the run exiting 1. Anything else, a
  `JudgeExhaustedError` included, aborts the rest of the calls and ends the run. A SIGINT through
  `deps.signal` aborts waiting and in-flight calls and exits 130.

- [#8](https://github.com/Siftline/toolkit/pull/8) [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81) Thanks [@l0st0](https://github.com/l0st0)! - Add `siftline test` and the async library door behind it.

  `run(argv, deps): Promise<number>` returns an exit code and takes
  `deps = { client, stdin, stdout, stderr, env, signal }`, the CLI's only seam. `USAGE` and
  `VERSION` stay exported, and `USAGE` is now the spec's text. The bin constructs the real
  `TypeSafeClient` from `@typesafe-ai/sdk`, a new runtime dependency pinned exactly, wires the
  process streams and a SIGINT-backed signal and sets `process.exitCode`.

  `siftline test <recipe.json> <fixtures.jsonl>` parses the Recipe with `recipeSchema` and the
  Fixtures with `parseFixtures`, runs `testRecipe` at `patient` retry with a gate of
  `--max-in-flight` (an integer of 1 or more, default 8), reports `ok fixture:n` and
  `miss fixture:n question: expected X, got Y` on stderr in completion order and prints the
  human report on stdout. `--json` prints the `TestReport` plus a top-level `drift`, `--quiet`
  silences progress but never a warning or an error, `--min-accuracy <ratio>` exits 1 when the
  lowest Question accuracy is below it with `null` counting as below, and `test` refuses
  `--rules`. A Question nothing asserted reads `n/a`.

  Exit codes: 0 success, 1 work that ran and failed, 2 usage and input errors, 130 after a
  SIGINT. A missing `TYPESAFE_API_KEY` is a usage error raised before any file is read, and the
  key never reaches argv, usage or a log line.

### Patch Changes

- [#8](https://github.com/Siftline/toolkit/pull/8) [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81) Thanks [@l0st0](https://github.com/l0st0)! - Two behaviour fixes in `@siftline/core`, both from the spec.

  `defineFixtures(recipe, fixtures)` now rebuilds each Fixture's `expect` in Recipe order, so
  `serializeFixture` writes the keys in that order whatever order the author wrote them in.
  Validation still runs first, so no expectation is dropped.

  `judge` no longer treats every throw during an abort as the abort. A 429 or a 400 that lands
  in the same tick as a sibling's abort is mapped to `JudgeExhaustedError` or `JudgeError` as
  usual; only the signal's own reason, an `AbortError` or an `APIUserAbortError` is rethrown
  untouched.

  `@siftline/cli` changes are internal: one exit-code formatter renamed, the two file readers
  collapsed onto one body, and `label` threads its options object instead of two positionals.
  Every message, exit code and byte of output is unchanged.

- [#8](https://github.com/Siftline/toolkit/pull/8) [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81) Thanks [@l0st0](https://github.com/l0st0)! - Shorten each README to a quickstart and a link to docs.siftline.dev, which now carries the guide, the package pages and the API reference.

- [#8](https://github.com/Siftline/toolkit/pull/8) [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81) Thanks [@l0st0](https://github.com/l0st0)! - Fold the duplicated shapes the 0.1.0 code review named.

  `@siftline/core` exports two more things. `AnswerValue` is the erased answer type, a label, a
  boolean or a level index, that `Mismatch` and the adapters were spelling out. `recordSchema`
  is the strict Record validator the CLI was hand-rolling. Rules and Fixtures now check a value
  against its Question through one function, so a Fixture problem reads as the Rule problem
  does, with ` for question "<name>"` appended: `value "yes" is not a boolean for question
"wants_human"`. The Recipe-fitting label problem is unchanged.

  `@siftline/actions` shares the three fixed headers between the adapters. No wire change.

  `@siftline/cli` gives each command its own flag table, so `label --json` and `test --rules`
  fail as `Unknown option '--json'` and `Unknown option '--rules'` rather than with a
  per-command sentence. A bad Record line is reported in the validator's words, for example
  `Unrecognized key: "text"`. Exit codes are unchanged.

- [#5](https://github.com/Siftline/toolkit/pull/5) [`1202aa9`](https://github.com/Siftline/toolkit/commit/1202aa95094da125e35cafda7af6300ce182f061) Thanks [@l0st0](https://github.com/l0st0)! - Trim source comments to those that prevent a mistake. Published `.d.mts` descriptions are
  shorter; no behaviour changes.
- Updated dependencies [[`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81), [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81), [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81), [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81), [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81), [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81), [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81), [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81), [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81), [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81), [`1202aa9`](https://github.com/Siftline/toolkit/commit/1202aa95094da125e35cafda7af6300ce182f061)]:
  - @siftline/core@0.1.0

## 0.0.2

### Patch Changes

- [#2](https://github.com/Siftline/toolkit/pull/2) [`54b1ad5`](https://github.com/Siftline/toolkit/commit/54b1ad5f6d0c162429ce92c36cafc9ef5617809a) Thanks [@l0st0](https://github.com/l0st0)! - Prove the release pipeline end to end. The scaffold shipped behind an empty
  changeset, so `version`, `pack` and `publish` have never actually run — this
  patch bump exercises all three, and the internal `@siftline/core` ranges in
  `@siftline/cli` and `@siftline/actions` along with them.
- Updated dependencies [[`54b1ad5`](https://github.com/Siftline/toolkit/commit/54b1ad5f6d0c162429ce92c36cafc9ef5617809a)]:
  - @siftline/core@0.0.3
