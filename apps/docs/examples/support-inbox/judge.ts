import { createJudge } from "@siftline/core";
import type { SystemOneClient } from "@siftline/core";

import { recipe } from "./recipe";

export async function judgeOne(client: SystemOneClient) {
  const judge = createJudge({ client });

  const decision = await judge(
    {
      id: "msg-1",
      state: {
        subject: "Charged twice",
        sender: "anna@example.com",
        text: "You charged my card twice this month. I want the second charge refunded now, and I want to talk to an actual person, not a bot.",
      },
    },
    recipe,
  );

  // `category` is "complaint" | "question" | "other", not string: the Recipe's labels
  // travel through the types.
  if (decision.answers.category === "complaint" && !decision.review) {
    console.log(`complaint from msg-1, urgency ${decision.answers.urgency}`);
  }

  return decision;
}
