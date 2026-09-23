# @siftline/actions

## 0.2.0

### Minor Changes

- [#13](https://github.com/Siftline/toolkit/pull/13) [`85c52a1`](https://github.com/Siftline/toolkit/commit/85c52a1d5cb178e47129c3d25f1c50b7a40ea5a8) Thanks [@l0st0](https://github.com/l0st0)! - Add `defineActions` and `dispatch`. To send routed Decisions:

  1. Declare your Actions with `defineActions({ [id]: { kind, config } })`. It parses every config
     against its kind's `configSchema` and returns an `ActionSet` with the ids kept literal. An
     invalid config, an unknown kind or an empty id throws `ActionBuildError` naming the id.
  2. Type your Rules as `Rule<Q, ActionId<typeof actions>>`. An undefined Action id fails to compile.
  3. Call `dispatch(decision, actions, recipe, { fetch?, signal? })` with that `ActionSet`. A
     hand-written object does not compile. It returns `null` for a Decision that went to Review or
     selected no Action. Otherwise it builds, performs once and returns
     `Dispatched`: `{ action, request, response }`, with `action` typed as your Action ids.
  4. Handle failures. An Action id not in `actions` throws `ActionBuildError`; an inherited name such
     as `toString` is never an Action id or kind. A failed send throws `perform`'s
     `ActionFailedError` with `retryable` intact. `dispatch` adds no retry and no timeout.

  `build`, `perform` and the `Idempotency-Key` are unchanged. With Action ids in your Rules the key
  reads `<decision id>:<action id>`.

- [#13](https://github.com/Siftline/toolkit/pull/13) [`85c52a1`](https://github.com/Siftline/toolkit/commit/85c52a1d5cb178e47129c3d25f1c50b7a40ea5a8) Thanks [@l0st0](https://github.com/l0st0)! - Change `perform(request, fetch, { signal })` to `perform(request, { fetch?, signal? })`. `fetch`
  defaults to the global `fetch`, read on each call, so on Node 22 or newer `perform(request)` is
  enough. Tests and Workers still inject their own: replace `perform(request, stub, { signal })`
  with `perform(request, { fetch: stub, signal })`. Export the options as `PerformOptions`. Sending
  is otherwise unchanged: one attempt, no retry, no timeout.

### Patch Changes

- [#13](https://github.com/Siftline/toolkit/pull/13) [`85c52a1`](https://github.com/Siftline/toolkit/commit/85c52a1d5cb178e47129c3d25f1c50b7a40ea5a8) Thanks [@l0st0](https://github.com/l0st0)! - Accept any zod 4 from 4.6.5 up, so an app on zod 4 installs one copy.
- Updated dependencies [[`85c52a1`](https://github.com/Siftline/toolkit/commit/85c52a1d5cb178e47129c3d25f1c50b7a40ea5a8), [`85c52a1`](https://github.com/Siftline/toolkit/commit/85c52a1d5cb178e47129c3d25f1c50b7a40ea5a8), [`85c52a1`](https://github.com/Siftline/toolkit/commit/85c52a1d5cb178e47129c3d25f1c50b7a40ea5a8), [`85c52a1`](https://github.com/Siftline/toolkit/commit/85c52a1d5cb178e47129c3d25f1c50b7a40ea5a8)]:
  - @siftline/core@0.2.0

## 0.1.1

### Patch Changes

- [#11](https://github.com/Siftline/toolkit/pull/11) [`478f62b`](https://github.com/Siftline/toolkit/commit/478f62be97853a1a3ba3bb4614f1a1096e65aeb2) Thanks [@l0st0](https://github.com/l0st0)! - Decode thrown SDK errors and CLI validation issues with Zod schemas instead of `typeof` checks. `createReplayClient` now matches a request by its JSON form, so a member set to `undefined` no longer blocks a match. `@siftline/cli` depends on `zod` directly.
- Updated dependencies [[`478f62b`](https://github.com/Siftline/toolkit/commit/478f62be97853a1a3ba3bb4614f1a1096e65aeb2)]:
  - @siftline/core@0.1.1

## 0.1.0

### Minor Changes

- [#8](https://github.com/Siftline/toolkit/pull/8) [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81) Thanks [@l0st0](https://github.com/l0st0)! - Add the Action adapters. `webhook` and `slackIncomingWebhook` turn a Decision into an
  `ActionRequest` — `{ method, url, headers, body, idempotencyKey }` — and `adapters` keys them
  by cloud's `action.kind`. `build(decision, config, recipe)` takes the Recipe because the Slack
  layout renders Score level descriptions, which the Decision does not carry. Nothing in a
  request reads a clock or randomness, so preview is `build` without `perform`.

  The webhook body is the `serializeDecision` line with no envelope, signed with
  `X-Siftline-Signature: sha256=<HMAC-SHA256>` through WebCrypto when a secret is configured.
  `idempotencyKey` is `<decision.id>:<decision.action>` and rides as the `Idempotency-Key`
  header; a Decision that selected no Action is an `ActionBuildError` (`action_build`, never
  retryable).

  `perform(request, fetch, { signal })` sends the request once — no retries, no timeout of its
  own — and returns `{ status, body, truncated }` with the body cut to 4096 bytes of UTF-8 on a
  code-point boundary. A non-2xx status or a thrown `fetch` is an `ActionFailedError` carrying
  `status` and `retryable`, true for 408, 429, 5xx and network failures.

  `@siftline/actions` now depends on `zod` directly: `Adapter<C>` exposes `configSchema` as a
  `ZodType<C>`, and the package cannot rely on reaching core's copy.

### Patch Changes

- [#8](https://github.com/Siftline/toolkit/pull/8) [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81) Thanks [@l0st0](https://github.com/l0st0)! - Rewrite `@siftline/core`'s README for the 0.1.0 surface: Recipes, the Judge and its in-flight
  gate, Rules and routing, Fixtures and the `TestReport`, the three file formats and the
  `@siftline/core/testing` entry. No README claims a walking skeleton any more.

  Record why `@siftline/actions` depends on zod directly: `Adapter<C>.configSchema` is a
  `ZodType<C>`, so zod is in the package's public types and has to resolve from the package
  itself.

- [#8](https://github.com/Siftline/toolkit/pull/8) [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81) Thanks [@l0st0](https://github.com/l0st0)! - Shorten each README to a quickstart and a link to docs.siftline.dev, which now carries the guide, the package pages and the API reference.

- [#8](https://github.com/Siftline/toolkit/pull/8) [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81) Thanks [@l0st0](https://github.com/l0st0)! - Add the Recipe format: `recipeSchema`, `questionSchema`, `parseRecipe`, `serializeRecipe`,
  `defineRecipe` and the `choice`, `noul` and `score` helpers. `defineRecipe` keeps literal
  labels and level indices; `serializeRecipe` is the only writer, so
  `serializeRecipe(parseRecipe(text))` returns the same bytes.

  Core's walking-skeleton `PLACEHOLDER` is gone. `@siftline/actions` folds in core's `VERSION`
  instead.

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
