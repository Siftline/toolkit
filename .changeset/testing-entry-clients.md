---
"@siftline/core": minor
---

Declare the client seam and ship the testing entry. Core declares `SystemOneClient`,
`SystemOneRequest`, `SystemOneResult`, `SystemOneCallOptions`, `RetryPolicy` and the wire
answer shapes itself, so nothing in core imports `@typesafe-ai/sdk`; a type-level test proves
the SDK's `TypeSafeClient` satisfies the interface.

`@siftline/core/testing` now exports `createScriptedClient`, `createReplayClient`,
`createRecordingClient`, `replayLineSchema` and `parseReplayLines`. The placeholder
`createFakeTypeSafeClient` is gone.
