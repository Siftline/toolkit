---
"@siftline/actions": minor
---

Change `perform(request, fetch, { signal })` to `perform(request, { fetch?, signal? })`. `fetch`
defaults to the global `fetch`, read on each call, so on Node 22 or newer `perform(request)` is
enough. Tests and Workers still inject their own: replace `perform(request, stub, { signal })`
with `perform(request, { fetch: stub, signal })`. Export the options as `PerformOptions`. Sending
is otherwise unchanged: one attempt, no retry, no timeout.
