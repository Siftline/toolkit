import packageJson from "../package.json" with { type: "json" };

/** The published version of `@siftline/core`, baked in at build time. */
export const VERSION: string = packageJson.version;

export { decisionSchema, parseDecision, recordSchema, serializeDecision } from "./decision";

export type { Answers, AnswerValue, Decision, Evidence, Record } from "./decision";

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

export {
  evaluateRules,
  routeDecision,
  ruleConditionSchema,
  ruleSchema,
  validateRules,
} from "./rules";

export type { Routing, Rule, RuleCondition, RuleProblem } from "./rules";

export { createJudge, DEFAULT_MAX_IN_FLIGHT, JudgeError, JudgeExhaustedError } from "./judge";

export type {
  CreateJudgeOptions,
  Judge,
  JudgeCallOptions,
  JudgeErrorReason,
  RetryMode,
} from "./judge";

export {
  compareAnswers,
  defineFixtures,
  fixtureSchema,
  FixtureParseError,
  FixtureValidationError,
  parseFixture,
  parseFixtures,
  scoreResults,
  serializeFixture,
  testRecipe,
  validateFixtures,
} from "./fixtures";

export type {
  Fixture,
  FixtureProblem,
  FixtureResult,
  Mismatch,
  QuestionAccuracy,
  TestRecipeOptions,
  TestReport,
} from "./fixtures";

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
