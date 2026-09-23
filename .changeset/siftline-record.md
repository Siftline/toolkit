---
"@siftline/core": minor
---

Rename the `Record` type to `SiftlineRecord`, so importing it no longer shadows TypeScript's global
`Record<K, V>`. There is no deprecated alias: change `import type { Record } from "@siftline/core"`
to `import type { SiftlineRecord } from "@siftline/core"` and rename its uses. The Judge's call
signature is now `judge(record: SiftlineRecord, recipe)`. `recordSchema`, `Decision.recordId` and
the Record and Decision line formats are unchanged.
