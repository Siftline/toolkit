import packageJson from "../package.json" with { type: "json" };

/** The published version of `@siftline/core`, baked in at build time. */
export const VERSION: string = packageJson.version;

export {
  choice,
  defineRecipe,
  noul,
  parseRecipe,
  questionSchema,
  recipeSchema,
  score,
  serializeRecipe,
} from "./recipe";
export type {
  ChoiceCriteria,
  ChoiceQuestion,
  DefineRecipeInput,
  Entry,
  EntryType,
  JsonValue,
  NoulQuestion,
  Question,
  Questions,
  Recipe,
  ScoreCriteria,
  ScoreQuestion,
} from "./recipe";

export type {
  AnswerResponse,
  ChoiceResponse,
  NoulResponse,
  RetryPolicy,
  ScoreResponse,
  SystemOneCallOptions,
  SystemOneClient,
  SystemOneRequest,
  SystemOneResult,
} from "./client";
