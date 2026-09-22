# @siftline/core

## 0.1.0

### Minor Changes

- [#8](https://github.com/Siftline/toolkit/pull/8) [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81) Thanks [@l0st0](https://github.com/l0st0)! - Add the Decision format: `Answers`, `Evidence`, `Decision`, `Record`, `decisionSchema`,
  `parseDecision` and `serializeDecision`. `serializeDecision` is the only writer — one compact
  line, the spec's key order, `answers` and `questions` in Recipe order, Score Evidence as
  `score, confidence, probabilities`, and no rounding — so the reference line round-trips byte
  for byte. `Decision<Q>` carries the Recipe's literal labels and level indices.

  Add `SiftlineError`, the base every toolkit error extends, with a required readonly `code` and
  `retryable`.

- [#8](https://github.com/Siftline/toolkit/pull/8) [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81) Thanks [@l0st0](https://github.com/l0st0)! - Add Fixtures and accuracy: `fixtureSchema`, `Fixture`, `parseFixture`, `parseFixtures`,
  `serializeFixture`, `validateFixtures`, `defineFixtures`, `compareAnswers`, `scoreResults`,
  `testRecipe`, the `FixtureResult`, `QuestionAccuracy`, `TestReport`, `Mismatch` and
  `FixtureProblem` shapes, and `FixtureValidationError` and `FixtureParseError` under
  `SiftlineError`.

  A Fixture is `{ state, expect, id?, origin?, by? }`, where `state` is any `EntryType` and
  `expect` is `Answers<Q>` made partial, so a Fixture written through `defineFixtures` carries
  the Recipe's literal labels and level indices. A line serializes as `id, origin, by, state,
expect` with absent optionals omitted, and round-trips byte for byte. `parseFixtures` skips
  blank lines and names the 1-based bad one.

  `validateFixtures(fixtures, recipe)` reports an unknown Question, a label outside the Choice,
  a non-boolean for a Noul, a level index out of range and a duplicate id, keyed by the
  Fixture's id or its 1-based index. `defineFixtures` and `testRecipe` both refuse on any
  problem; `testRecipe` does so before the first Judge call.

  `testRecipe(judge, recipe, fixtures, { signal, onResult })` fires every Fixture through the
  Judge at once and lets the Judge's gate meter concurrency, calls `onResult` in completion
  order, and scores when all are done. The first `JudgeError` or `JudgeExhaustedError` aborts
  the rest and is rethrown. A Question absent from a Fixture's `expect` leaves that Question's
  denominator, an unsure Decision counts on its answers, and the report's `accuracy` is the
  minimum over the Questions that were asserted, `null` when nothing was.

- [#8](https://github.com/Siftline/toolkit/pull/8) [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81) Thanks [@l0st0](https://github.com/l0st0)! - Add the Judge: `createJudge`, `Judge`, `DEFAULT_MAX_IN_FLIGHT`, `JudgeExhaustedError` and
  `JudgeError`. `createJudge({ client, retry, maxInFlight, now })` returns a callable
  `judge(record, recipe, { id, signal })` that answers with a `Decision<Q>` carrying the
  Recipe's literal labels and level indices.

  Answers follow the recorded Jev shapes. Choice probabilities are rebuilt in Recipe label
  order and Score probabilities by index, so `serializeDecision` writes the Recipe's order; a
  missing key is a `JudgeError`. Both answers are the argmax of the rebuilt probabilities, with
  the lowest key winning a tie — a Score answer never reads `score`, which is copied into
  Evidence untouched. Noul confidence is `|2p − 1|` rounded to two decimals; Choice and Score
  confidences are the model's own.

  The chosen `retry` mode goes to the client as `retry` and `timeout` on every call, and a FIFO
  gate admits at most `maxInFlight` concurrent calls, a slot covering the whole call. An
  aborted waiter never takes a slot, and the client's abort error is rethrown untouched.

  A 429 or 529 becomes a `JudgeExhaustedError` with the server's `retryAfterMs` or `null`.
  Everything else becomes a `JudgeError` with a `reason` of `max_tokens_exceeded`,
  `api_usage_error`, `network`, `timeout`, `invalid_answers` or `unknown`; only `network` and
  `timeout` are retryable.

- [#8](https://github.com/Siftline/toolkit/pull/8) [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81) Thanks [@l0st0](https://github.com/l0st0)! - Add the Recipe format: `recipeSchema`, `questionSchema`, `parseRecipe`, `serializeRecipe`,
  `defineRecipe` and the `choice`, `noul` and `score` helpers. `defineRecipe` keeps literal
  labels and level indices; `serializeRecipe` is the only writer, so
  `serializeRecipe(parseRecipe(text))` returns the same bytes.

  Core's walking-skeleton `PLACEHOLDER` is gone. `@siftline/actions` folds in core's `VERSION`
  instead.

- [#8](https://github.com/Siftline/toolkit/pull/8) [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81) Thanks [@l0st0](https://github.com/l0st0)! - Add Rules: `ruleConditionSchema`, `ruleSchema`, `Rule<Q>`, `RuleCondition`, `Routing`,
  `RuleProblem`, `evaluateRules`, `routeDecision` and `validateRules`. Six comparators, closed —
  Choice `is`/`isOneOf`, Noul `is`, Score `is`/`atLeast`/`atMost` — with the condition schema a
  strict discriminated union on `comparator`, so `value` is typed per comparator at parse time.

  `evaluateRules(answers, rules)` is pure, first match wins, and never throws: a missing
  Question, a runtime type mismatch and an unknown value each evaluate false and evaluation
  continues. `routeDecision(decision, rules)` returns a copy and leaves `rule` and `action` null
  when the Decision is under review. `validateRules(rules, recipe)` warns about stale Rules.

  A Rule literal written against a `Recipe<Q>` has its question names, labels and level indices
  checked at compile time.

- [#8](https://github.com/Siftline/toolkit/pull/8) [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81) Thanks [@l0st0](https://github.com/l0st0)! - Declare the client seam and ship the testing entry. Core declares `SystemOneClient`,
  `SystemOneRequest`, `SystemOneResult`, `SystemOneCallOptions`, `RetryPolicy` and the wire
  answer shapes itself, so nothing in core imports `@typesafe-ai/sdk`; a type-level test proves
  the SDK's `TypeSafeClient` satisfies the interface.

  `@siftline/core/testing` now exports `createScriptedClient`, `createReplayClient`,
  `createRecordingClient`, `replayLineSchema` and `parseReplayLines`. The placeholder
  `createFakeTypeSafeClient` is gone.

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

- [#8](https://github.com/Siftline/toolkit/pull/8) [`9cb748e`](https://github.com/Siftline/toolkit/commit/9cb748ec101b2e3593187a75c6384502d2718b81) Thanks [@l0st0](https://github.com/l0st0)! - Rewrite `@siftline/core`'s README for the 0.1.0 surface: Recipes, the Judge and its in-flight
  gate, Rules and routing, Fixtures and the `TestReport`, the three file formats and the
  `@siftline/core/testing` entry. No README claims a walking skeleton any more.

  Record why `@siftline/actions` depends on zod directly: `Adapter<C>.configSchema` is a
  `ZodType<C>`, so zod is in the package's public types and has to resolve from the package
  itself.

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

## 0.0.3

### Patch Changes

- [#2](https://github.com/Siftline/toolkit/pull/2) [`54b1ad5`](https://github.com/Siftline/toolkit/commit/54b1ad5f6d0c162429ce92c36cafc9ef5617809a) Thanks [@l0st0](https://github.com/l0st0)! - Prove the release pipeline end to end. The scaffold shipped behind an empty
  changeset, so `version`, `pack` and `publish` have never actually run — this
  patch bump exercises all three, and the internal `@siftline/core` ranges in
  `@siftline/cli` and `@siftline/actions` along with them.
