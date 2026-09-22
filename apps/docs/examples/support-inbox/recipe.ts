import { choice, defineRecipe, noul, score } from "@siftline/core";

export const recipe = defineRecipe({
  name: "support-inbox",
  version: 2,
  model: "jev-1.13.0",
  questions: {
    category: choice("Which category best describes this message?", {
      complaint: "The sender is unhappy with the product or service",
      question: "The sender asks how something works",
      other: "Anything else, including spam and thanks",
    }),
    wants_human: noul("Does the sender ask to speak to a person?"),
    urgency: score("How soon does this need a reply?", ["Can wait a week", "This week", "Today"]),
  },
});
