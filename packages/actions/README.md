# @siftline/actions

Siftline adapters that carry a Decision to a webhook or to Slack.

```sh
npm install @siftline/actions
```

```ts
import { perform, webhook } from "@siftline/actions";

const request = await webhook.build(decision, { url, secret }, recipe);
const { status, body, truncated } = await perform(request, fetch);
```

`build` is pure and `perform` sends once, so a preview is `build` without `perform`. The
webhook body is the Decision line, signed with HMAC-SHA256 when a `secret` is set;
`slackIncomingWebhook` posts one message.

The guide and the full reference live at
[docs.siftline.dev](https://docs.siftline.dev/docs/packages/actions).

ESM only. Node 22.14 or newer.

## Licence

MIT — see [LICENSE](./LICENSE).
