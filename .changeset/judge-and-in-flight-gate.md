---
"@siftline/core": minor
---

Add the Judge: `createJudge`, `Judge`, `DEFAULT_MAX_IN_FLIGHT`, `JudgeExhaustedError` and
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
