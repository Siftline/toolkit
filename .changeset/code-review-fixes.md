---
"@siftline/core": patch
"@siftline/cli": patch
---

Two behaviour fixes in `@siftline/core`, both from the spec.

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
