---
"@siftline/core": minor
---

Make `CreateJudgeOptions.retry` optional. `createJudge({ client })` now uses the `"prompt"` policy:
1 retry and 10 s per attempt, so an exhausted rate limit throws `JudgeExhaustedError` within
seconds. An explicit `retry` behaves exactly as in 0.1. Pass `retry: "patient"` for batch work that
must survive a 429. Each `RetryMode` member now documents its retries, timeout and use.
