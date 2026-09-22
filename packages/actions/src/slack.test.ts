import { slackIncomingWebhook } from "@siftline/actions";
import { describe, expect, it } from "vitest";

import { feedbackWidget, routedDecision } from "./fixtures";

const url = "https://hooks.slack.com/services/T000/B000/xxx";

describe("slackIncomingWebhook.build", () => {
  it("renders the fixed layout over feedback-widget, and nothing but the text", async () => {
    const request = await slackIncomingWebhook.build(routedDecision(), { url }, feedbackWidget());

    expect(request.body).toBe(
      JSON.stringify({
        text: [
          "*feedback-widget* · rec_4c11",
          "team: billing (88%)",
          "angry: yes (72%)",
          "urgency: 2 · Today (70%)",
          "rule r2",
        ].join("\n"),
      }),
    );
  });

  it("renders a false Noul as no", async () => {
    const decision = routedDecision();
    decision.answers["angry"] = false;
    const request = await slackIncomingWebhook.build(decision, { url }, feedbackWidget());

    expect(request.body).toContain("angry: no (72%)");
  });

  it("POSTs to the configured Slack url", async () => {
    const request = await slackIncomingWebhook.build(routedDecision(), { url }, feedbackWidget());

    expect(request.method).toBe("POST");
    expect(request.url).toBe(url);
    expect(request.headers["Content-Type"]).toBe("application/json");
  });
});
