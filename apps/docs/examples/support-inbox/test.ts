import { createJudge, defineFixtures, testRecipe } from "@siftline/core";
import type { SystemOneClient } from "@siftline/core";

import { recipe } from "./recipe";

export async function measure(client: SystemOneClient) {
  const fixtures = defineFixtures(recipe, [
    {
      state: { subject: "Charged twice", text: "Refund me now and get me a human." },
      expect: { category: "complaint", wants_human: true, urgency: 2 },
    },
    {
      state: { subject: "Export question", text: "How do I export to CSV?" },
      expect: { category: "question", wants_human: false },
    },
  ]);

  // A batch has no caller waiting, so it retries through a 429 instead of failing fast.
  const judge = createJudge({ client, retry: "patient" });
  const report = await testRecipe(judge, recipe, fixtures);

  console.log(`lowest accuracy ${report.accuracy}`);

  for (const result of report.fixtures) {
    for (const miss of result.mismatches) {
      console.log(`${result.id} ${miss.question}: expected ${miss.expected}, got ${miss.actual}`);
    }
  }

  return report;
}
