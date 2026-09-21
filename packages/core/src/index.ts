import packageJson from "../package.json" with { type: "json" };

/** The published version of `@siftline/core`, baked in at build time. */
export const VERSION: string = packageJson.version;

export { decisionSchema, parseDecision, serializeDecision } from "./decision";
export type { Answers, Decision, Evidence, Record } from "./decision";
export { SiftlineError } from "./errors";
export type { SiftlineErrorCode } from "./errors";
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

export { createJudge, DEFAULT_MAX_IN_FLIGHT, JudgeError, JudgeExhaustedError } from "./judge";
export type {
  CreateJudgeOptions,
  Judge,
  JudgeCallOptions,
  JudgeErrorReason,
  RetryMode,
} from "./judge";

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
