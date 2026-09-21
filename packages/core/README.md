# @siftline/core

The Siftline engine: recipes, rules, fixtures and the judge wrapper.

The Recipe format lands first: `defineRecipe` with the `choice`, `noul` and `score`
helpers builds one in TypeScript with literal label and level types, `parseRecipe` and
`serializeRecipe` are the only door to and from JSON, and `recipeSchema` validates a
document that arrives from elsewhere. Rules, fixtures and the judge wrapper land next.

```ts
import { choice, defineRecipe, noul, serializeRecipe } from "@siftline/core";

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

await Bun.write("support-inbox.json", serializeRecipe(recipe));
```

`reviewThreshold` defaults to 0.7. `parseRecipe` never defaults it: a document on disk
carries it or fails to parse.

ESM only. Node 22.14 or newer.

## Licence

MIT — see [LICENSE](./LICENSE).
