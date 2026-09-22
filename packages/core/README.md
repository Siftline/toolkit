# @siftline/core

The Siftline Engine: Recipes, the Judge, Rules, Fixtures and the Decision format.

```sh
npm install @siftline/core @typesafe-ai/sdk
```

```ts
import { choice, createJudge, defineRecipe, noul, serializeDecision } from "@siftline/core";
import { TypeSafeClient } from "@typesafe-ai/sdk";

const recipe = defineRecipe({
  name: "support-inbox",
  version: 1,
  model: "jev-1.13.0",
  questions: {
    category: choice("Which category best describes this message?", {
      complaint: "The sender is unhappy with the product or service",
      question: "The sender asks how something works",
      other: "Anything else, including spam and thanks",
    }),
    wants_human: noul("Does the sender ask to speak to a person?"),
  },
});

const client = new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY });
const judge = createJudge({ client, retry: "patient" });
const decision = await judge({ id: "msg-1", state: "…" }, recipe);

console.log(serializeDecision(decision));
```

`decision.answers.category` is `"complaint" | "question" | "other"`, not `string`: the
Recipe's labels travel through the types.

The guide and the full reference live at
[docs.siftline.dev](https://docs.siftline.dev/docs/packages/core). `@siftline/core/testing`
ships the scripted, replay and recording clients tests judge with.

ESM only. Node 22.14 or newer.

## Licence

MIT. See [LICENSE](./LICENSE).
