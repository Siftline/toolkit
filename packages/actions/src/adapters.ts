import type { ActionKind } from "./adapter";
import { slackIncomingWebhook } from "./slack";
import { webhook } from "./webhook";

/** Every Adapter, keyed by cloud's `action.kind`. */
export const adapters = {
  webhook,
  slack_incoming_webhook: slackIncomingWebhook,
  // Exhaustive over `ActionKind`: a new kind without an Adapter fails to compile.
} satisfies { [K in ActionKind]: { kind: ActionKind } };
