---
"@siftline/actions": minor
---

Add `defineActions` and `dispatch`. To send routed Decisions:

1. Declare your Actions with `defineActions({ [id]: { kind, config } })`. It parses every config
   against its kind's `configSchema` and returns an `ActionSet` with the ids kept literal. An
   invalid config, an unknown kind or an empty id throws `ActionBuildError` naming the id.
2. Type your Rules as `Rule<Q, ActionId<typeof actions>>`. An undefined Action id fails to compile.
3. Call `dispatch(decision, actions, recipe, { fetch?, signal? })` with that `ActionSet`. A
   hand-written object does not compile. It returns `null` for a Decision that went to Review or
   selected no Action. Otherwise it builds, performs once and returns
   `Dispatched`: `{ action, request, response }`, with `action` typed as your Action ids.
4. Handle failures. An Action id not in `actions` throws `ActionBuildError`; an inherited name such
   as `toString` is never an Action id or kind. A failed send throws `perform`'s
   `ActionFailedError` with `retryable` intact. `dispatch` adds no retry and no timeout.

`build`, `perform` and the `Idempotency-Key` are unchanged. With Action ids in your Rules the key
reads `<decision id>:<action id>`.
