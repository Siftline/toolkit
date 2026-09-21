# @siftline/actions

Siftline adapters for the places labels land: issue trackers, inboxes and queues.

Building a request and sending it are two steps. An Adapter turns a Decision into an
`ActionRequest`; `perform` sends it with an injected `fetch`. Preview is `build` without
`perform`, so there is no flag to set wrong, and nothing in a request depends on a clock or
randomness — the same Decision, config and Recipe always build the same bytes.

```ts
import { perform, webhook } from "@siftline/actions";

const request = await webhook.build(decision, { url, secret }, recipe);
const { status, body, truncated } = await perform(request, fetch);
```

`build` needs the Recipe because the Slack layout renders Score level descriptions, which the
Decision does not carry. It throws `ActionBuildError` when the Decision selected no Action.

The webhook body is the `serializeDecision` line with no envelope, so a receiver runs
`parseDecision` on it. With a `secret` the request carries
`X-Siftline-Signature: sha256=<HMAC-SHA256 of the body>`. Every request carries
`Idempotency-Key: <decision.id>:<decision.action>`; Slack ignores it, so a redelivery past
the caller's own guard posts twice.

`perform` sends once — no retries, no timeout of its own — and keeps the first 4096 bytes of
the response, cut on a code-point boundary. A non-2xx status or a thrown `fetch` raises
`ActionFailedError` with `status` and `retryable`, true for 408, 429, 5xx and network
failures. `adapters` maps `"webhook"` and `"slack_incoming_webhook"` to the pair, each with a
`configSchema` for a config that arrives as JSON.

ESM only. Node 22.14 or newer.

## Licence

MIT — see [LICENSE](./LICENSE).
