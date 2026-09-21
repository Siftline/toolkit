# Live Jev answers for replay tests

Resolves `.scratch/toolkit-mvp/issues/08-record-live-answers.md`. Recorded 2026-09-21
against `@typesafe-ai/sdk@0.6.0`, model `jev-1.13.0` pinned, the patient retry policy of
ticket 05 (`maxRetries: 5`, `backoffMaxMs: 30000`, `maxRetryAfterMs: 60000`, 30 s per
attempt). No retry fired. The recorder script is not in the repo; it built the three
example Recipes of ticket 02 verbatim and called `client.systemOne(...).withResponse()`.

Recordings: `packages/core/fixtures/replay/*.jsonl`, one file per Recipe plus
`probes.jsonl`.

## 1. Replay line format

One JSON object per line. `request` is the exact `SystemOneRequest` body; `response` is
the raw `SystemOneResult` with snake-case `usage`, untouched, so a replay client that
returns it exercises the Judge's whole mapping.

```json
{
  "format": 1,
  "id": "<recipe name>/<record id>",
  "recordedAt": "2026-09-21T15:26:37.104Z",
  "requestId": "req_01a0c4…",
  "durationMs": 845,
  "request": { "state": …, "questions": { … }, "model": "jev-1.13.0" },
  "response": { "model": "jev-1.13.0", "answers": { … }, "usage": { "input_tokens": 412, "output_tokens": 60 } }
}
```

An error line carries `error` instead of `response`:
`{ "name", "message", "status", "retryAfterMs", "body" }` as the SDK's `APIError` exposes
them. A replay client keyed on `request` (state, questions, model) MUST rethrow such a line
as the named SDK error class with that status and body.

The `id` inside each line is the Record id; a replay fixture for ticket 06 uses the same
`state` with an `expect` derived from `response.answers`.

## 2. What the answers look like

Twenty calls: 17 answered, 3 probes. All 17 returned `model: "jev-1.13.0"`.

### Choice

- `choice` is always one of the Recipe's labels. `probabilities` has every label as a
  key, values rounded to two decimals, summing to 1.00 ± 0.01.
- **Key order is not the Recipe's.** `{"question":0,"other":0,"complaint":1}` came back for
  a Recipe declaring `complaint, question, other`; the order differs call to call. The
  Judge MUST rebuild `probabilities` in Recipe order before `serializeDecision` writes it
  (ticket 03's byte-for-byte promise depends on it).
- `confidence` is neither the top probability nor the margin. Observed pairs
  (top probability → confidence): 0.52 → 0.28, 0.70 → 0.54, 0.72 → 0.58, 0.74 → 0.61,
  0.86 → 0.78, 0.93 → 0.89, 0.96 → 0.94, 0.98 → 0.97, 1.00 → 1. Monotonic in the top
  probability, steeper near 0.5. Clear-cut inputs give exactly `1` with `0` everywhere
  else; a plausible fake returns 1.00 for easy cases and 0.3 to 0.9 for mixed ones.

### Noul

- Only `{ "type": "noul", "noul": p }`, no `confidence`, confirming ticket 01.
- Observed `p`: 0.01, 0.02, 0.03, 0.04, 0.06, 0.15, 0.25, 0.87, 0.92, 0.99. Two decimals.
  Ticket 02's derived confidence `|2p − 1|` on these ranges from 0.5 (p = 0.25) to 0.98.

### Score

- **`score` is a decimal expected value, not a level index.** Observed on the four-level
  urgency rubric: 3, 0.2, 1.08, 1.54, 2.05, 0.39. It equals `Σ index × probability` to two
  decimals (0.81 × 0 + 0.19 × 1 = 0.19 ≈ 0.2). Ticket 14 decides how the Judge turns this
  into ticket 03's level index; `Math.round` and argmax agree on every recorded line, but
  the 1.54 case (probabilities 0.01, 0.45, 0.54, 0) shows how thin that margin can be.
- `probabilities` keys are the string indices `"0"` to `"n − 1"`, always in ascending
  order, every index present.
- `legend` echoes the Recipe's criteria by index. The Judge drops it (ticket 03).
- `confidence` tracks the top probability the same way Choice does: 1.00 → 1, 0.92 → 0.92,
  0.89 → 0.89, 0.81 → 0.8, 0.65 → 0.61, 0.54 → 0.54.

### Usage and latency

| Recipe | input tokens per call | output tokens per call | latency |
| --- | --- | --- | --- |
| support-inbox (Choice + Noul) | 383 to 412 | 59 to 60 | 829 to 845 ms |
| feedback-widget (all three) | 459 to 480 | 70 | 322 to 778 ms |
| doc-pair-check (two Choices) | 453 to 466 | 83 to 85 | 265 to 356 ms |

Output tokens are constant per Recipe, so they measure the answer schema, not the state.
Six calls in flight at once ran without a 429.

## 3. Probes (`probes.jsonl`)

| Probe | Result |
| --- | --- |
| `model: "jev-0.0.0"` | `BadRequestError`, status 400, body `{"detail":{"error_type":"api_usage_error","message":"Unknown model: jev-0.0.0"}}`. No `usage`, so unbilled. |
| `model: "jev-latest"` | Accepted; `response.model` is `jev-1.13.0`. The Recipe schema still rejects the alias (ticket 02); the API does not. |
| state of ~240k characters | `BadRequestError`, status 400, body `{"detail":{"error_type":"max_tokens_exceeded"}}`, no `usage`. 2.7 s to reject. Not 413 or 422. |

Both failures are 400, so ticket 05's `JudgeError.status` alone cannot tell "over budget"
from "unknown model". The SDK's `APIError.body.detail.error_type` can, and
`max_tokens_exceeded` is the string ticket 12's `label` needs if it wants to report a
Record too long to judge. Neither probe is retried by the SDK (400 is not in
`httpStatuses`).

## 4. Cost

| | |
| --- | --- |
| Calls | 20 (17 answered, 1 alias probe answered, 2 rejected) |
| Input tokens billed | 7,882 |
| Output tokens | 1,253 (free) |
| Price | $0.042 per million input tokens |
| **Total** | **$0.00033** |

A full `siftline test` over a hundred Fixtures of this size costs about two tenths of a
cent. Cost is not a design constraint for the MVP's Fixture volumes.

## 5. What the `/testing` fake should imitate

- Return `model` equal to the request's `model`, or `jev-1.13.0` for an alias.
- Choice: every label present in `probabilities`, two-decimal values, shuffled key order,
  `confidence` in [0, 1] with `1` for a scripted "certain" answer.
- Noul: `{ type, noul }` only.
- Score: every index present in ascending order, `score` = expected value to two decimals,
  `legend` echoed from criteria.
- `usage` in snake case, `input_tokens` in the hundreds, `output_tokens` a constant per
  Recipe.
- Errors: throw the SDK's error classes with `status` and `body.detail.error_type`.
