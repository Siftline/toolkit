# Fixtures

Example JSONL fixture sets for `@siftline/core` live here — the inputs a recipe is
measured against.

`recipes/` holds the three reference Recipes — `support-inbox`, `feedback-widget` and
`doc-pair-check` — each written in `serializeRecipe` form, so the round-trip test compares
bytes. Every package's tests reuse them.

`decisions/` holds the reference Decision line for `support-inbox`, in `serializeDecision`
form: one line, no trailing newline, 518 bytes. It is the round-trip vector and the body of
the pinned HMAC vector in `@siftline/actions`.

Fixtures are test data, not published output, so this directory stays out of `files`.
