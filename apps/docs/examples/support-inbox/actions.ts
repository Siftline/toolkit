import { defineActions } from "@siftline/actions";

// Rules name an Action by its id. The kind says how it is sent; two Actions may share one.
// Every config is checked here, so a bad URL fails at startup.
export const actions = defineActions({
  escalations: { kind: "webhook", config: { url: "https://example.com/hooks/escalations" } },
  "linear-tickets": {
    kind: "webhook",
    config: { url: "https://example.com/hooks/siftline", secret: "shared-secret" },
  },
});
