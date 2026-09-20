---
"@siftline/actions": patch
"@siftline/cli": patch
"@siftline/core": patch
---

Prove the release pipeline end to end. The scaffold shipped behind an empty
changeset, so `version`, `pack` and `publish` have never actually run — this
patch bump exercises all three, and the internal `@siftline/core` ranges in
`@siftline/cli` and `@siftline/actions` along with them.
