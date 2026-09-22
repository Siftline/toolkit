---
"@siftline/core": patch
"@siftline/actions": patch
"@siftline/cli": patch
---

Fold the duplicated shapes the 0.1.0 code review named.

`@siftline/core` exports two more things. `AnswerValue` is the erased answer type, a label, a
boolean or a level index, that `Mismatch` and the adapters were spelling out. `recordSchema`
is the strict Record validator the CLI was hand-rolling. Rules and Fixtures now check a value
against its Question through one function, so a Fixture problem reads as the Rule problem
does, with ` for question "<name>"` appended: `value "yes" is not a boolean for question
"wants_human"`. The Recipe-fitting label problem is unchanged.

`@siftline/actions` shares the three fixed headers between the adapters. No wire change.

`@siftline/cli` gives each command its own flag table, so `label --json` and `test --rules`
fail as `Unknown option '--json'` and `Unknown option '--rules'` rather than with a
per-command sentence. A bad Record line is reported in the validator's words, for example
`Unrecognized key: "text"`. Exit codes are unchanged.
