---
"@siftline/actions": minor
---

Add the Action adapters. `webhook` and `slackIncomingWebhook` turn a Decision into an
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
