---
"@siftline/core": minor
---

Add Fixtures and accuracy: `fixtureSchema`, `Fixture`, `parseFixture`, `parseFixtures`,
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
