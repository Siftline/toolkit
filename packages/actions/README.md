# @siftline/actions

The Siftline webhook adapter: it carries a Decision to your endpoint.

```sh
npm install @siftline/actions
```

```ts
import { defineActions, dispatch } from "@siftline/actions";

const actions = defineActions({
  "linear-tickets": { kind: "webhook", config: { url, secret } },
  escalations: {
    kind: "webhook",
    config: { url: discordUrl, body: '{ "content": "{{record.sender}}: {{record.text}}" }' },
  },
});

const sent = await dispatch(decision, { text, sender }, actions, recipe);
```

`defineActions` checks every config when you call it. `dispatch` sends the Action the Decision
selected, once, through the global `fetch` (or the one you pass as `{ fetch }`), and returns
`{ action, request, response }`. It returns `null` for a Decision that went to Review or
selected no Action. A preview is an Adapter's `build` without sending. The webhook body is the
Decision line, or the Action's Body template rendered with the Decision and the Record you pass.
It is signed with HMAC-SHA256 when a `secret` is set.

The guide and the full reference live at
[docs.siftline.dev](https://docs.siftline.dev/docs/packages/actions).

ESM only. Node 22.14 or newer.

## Licence

MIT. See [LICENSE](./LICENSE).
