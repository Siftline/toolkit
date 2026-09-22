---
"@siftline/actions": minor
---

Add `defineActions(definitions)` and `dispatch(decision, actions, recipe, { fetch?, signal? })`.
`defineActions` takes Actions keyed by Action id, each `{ kind, config }`, parses every config
against its kind's `configSchema` when called, and keeps the ids as literal keys. It throws
`ActionBuildError` naming the Action id for an invalid config, an unknown kind or an empty id.
An unknown kind is also a compile error. `dispatch` returns `null` for a Decision that went to
Review or selected no Action, throws `ActionBuildError` for an Action id not in `actions`, and
otherwise builds with that Action's Adapter, performs once and returns
`{ action, request, response }`. It adds no retry or timeout; a failed send throws `perform`'s
`ActionFailedError` with `retryable` intact. `build`, `perform` and the `Idempotency-Key` are
unchanged: with Action ids in your Rules the key reads `<decision id>:<action id>`.
