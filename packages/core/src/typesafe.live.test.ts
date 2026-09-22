import { readFileSync } from "node:fs";

import { createJudge, parseDecision, parseRecipe, serializeDecision } from "@siftline/core";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";

const apiKey = process.env["TYPESAFE_API_KEY"];

// Real Jev calls, billed. Only `bun run test:live` runs this; Turborepo never does.
describe.skipIf(!apiKey)("live TypeSafe access", () => {
  it("has an API key to call with", () => {
    expect(apiKey).toBeTruthy();
  });

  it("judges a support-inbox Record through the real client", async () => {
    const recipe = parseRecipe(
      readFileSync(new URL("../fixtures/recipes/support-inbox.json", import.meta.url), "utf8"),
    );

    const judge = createJudge({ client: new TypeSafeClient({ apiKey }), retry: "patient" });

    const decision = await judge(
      {
        id: "live-01",
        state: {
          subject: "Charged twice",
          sender: "anna@example.com",
          text: "You charged my card twice this month. I want the second charge refunded now, and I want to talk to an actual person, not a bot.",
        },
      },
      recipe,
    );

    expect(decision.format).toBe(1);
    expect(decision.recordId).toBe("live-01");
    expect(decision.recipe).toEqual({ name: "support-inbox", version: 1 });
    expect(decision.model).toBe(recipe.model);
    expect(decision.trimmed).toBe(false);
    expect(decision.rule).toBeNull();
    expect(decision.action).toBeNull();

    expect(Object.keys(decision.answers)).toEqual(["category", "wants_human"]);
    expect(["complaint", "question", "other"]).toContain(decision.answers["category"]);
    expect(decision.answers["wants_human"]).toBeTypeOf("boolean");
    expect(Object.keys(decision.questions)).toEqual(["category", "wants_human"]);

    expect(decision.confidence).toBeGreaterThanOrEqual(0);
    expect(decision.confidence).toBeLessThanOrEqual(1);
    expect(decision.review).toBe(decision.confidence < recipe.reviewThreshold);
    expect(decision.usage.inputTokens).toBeGreaterThan(0);

    expect(parseDecision(serializeDecision(decision))).toEqual(decision);
  }, 60000);
});
