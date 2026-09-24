---
"@siftline/actions": minor
---

Remove the Slack incoming webhook adapter. Webhook is the only Action kind. `slackIncomingWebhook`,
`SlackIncomingWebhookConfig` and the `slack_incoming_webhook` kind are gone, and `defineActions`
now throws `ActionBuildError` for that kind. To keep posting to Slack, point a `webhook` Action at
a relay that turns the Decision line into Slack's `{ "text": … }` body.
