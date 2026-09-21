# Fixtures

Example JSONL fixture sets for `@siftline/core` live here: the inputs a recipe is measured
against. Fixtures are test data, not published output, so this directory stays out of `files`.

`recipes/` holds the three reference Recipes — `support-inbox`, `feedback-widget` and
`doc-pair-check` — each written in `serializeRecipe` form, so the round-trip test compares
bytes. Every package's tests reuse them.

`decisions/` holds the reference Decision line for `support-inbox`, in `serializeDecision`
form: one line, no trailing newline, 518 bytes. It is the round-trip vector and the body of
the pinned HMAC vector in `@siftline/actions`.

`replay/` holds real `jev-1.13.0` request and response pairs for the three example Recipes,
recorded 2026-09-21. Format and findings: `docs/research/live-answers.md`.
