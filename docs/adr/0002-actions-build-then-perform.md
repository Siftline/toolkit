# An Action adapter builds a request; performing it is a separate, injected step

Date: 2026-09-21
Status: accepted

The hosted app delivers Records through a queue that can redeliver, so every Action must be
safe under at-least-once delivery, and the handoff wants Actions to start in preview mode.
An adapter in `@siftline/actions` therefore only builds an `ActionRequest` (URL, headers,
body, an idempotency key derived from the Decision id). A separate `perform` sends it with
an injected `fetch`. Preview mode is build without perform. Tests need no network, and the
app can log the exact request before sending it.

## Consequences

- Email forward is not an MVP adapter: it needs a transport that is neither `fetch` nor a
  binding the packages may touch (cloud ADR 0001). It returns with an injected sender.
- Webhook is the only MVP adapter. The Slack incoming webhook adapter shipped in 0.1.0 and was
  removed on 2026-09-23 to keep the MVP to one Action kind. Slack returns only as a new decision.
