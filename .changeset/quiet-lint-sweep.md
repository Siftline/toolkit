---
"@siftline/core": patch
"@siftline/cli": patch
"@siftline/actions": patch
---

Decode thrown SDK errors and CLI validation issues with Zod schemas instead of `typeof` checks. `createReplayClient` now matches a request by its JSON form, so a member set to `undefined` no longer blocks a match. `@siftline/cli` depends on `zod` directly.
