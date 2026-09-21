---
"@siftline/cli": minor
---

Add `siftline test` and the async library door behind it.

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
