---
"@siftline/core": minor
---

Add the Decision format: `Answers`, `Evidence`, `Decision`, `Record`, `decisionSchema`,
`parseDecision` and `serializeDecision`. `serializeDecision` is the only writer — one compact
line, the spec's key order, `answers` and `questions` in Recipe order, Score Evidence as
`score, confidence, probabilities`, and no rounding — so the reference line round-trips byte
for byte. `Decision<Q>` carries the Recipe's literal labels and level indices.

Add `SiftlineError`, the base every toolkit error extends, with a required readonly `code` and
`retryable`.
