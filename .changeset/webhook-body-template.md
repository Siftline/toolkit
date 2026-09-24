---
"@siftline/actions": minor
---

A webhook Action takes an optional `body`, a Body template. It is JSON whose string values may
hold `{{record.text}}`, `{{answers.<name>}}` and the other documented variables, so a webhook can
post straight to Discord. Breaking: `dispatch(decision, record, actions, recipe)` and
`Adapter.build(decision, record, config, recipe)` take a required `RecordContext`,
`{ text, sender?, source? }`, after the Decision. Pass the Record the Decision is about.
