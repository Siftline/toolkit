import { defineActions } from "@siftline/actions";

// Rules name an Action by its id. The kind says how it is sent; two Actions may share one.
// Every config is checked here, so a bad URL or Body template fails at startup.
export const actions = defineActions({
  escalations: {
    kind: "webhook",
    config: {
      url: "https://example.com/hooks/escalations",
      // A Body template: Discord's shape instead of the Decision line.
      body: JSON.stringify({
        content:
          "Escalated by {{rule}}, urgency {{answers.urgency}}. {{record.sender}} wrote:\n{{record.text}}",
        allowed_mentions: { parse: [] },
      }),
    },
  },
  "linear-tickets": {
    kind: "webhook",
    config: { url: "https://example.com/hooks/siftline", secret: "shared-secret" },
  },
});
