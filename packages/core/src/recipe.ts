import { z } from "zod";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** The SDK's `EntryType`: prose, a JSON object or a JSON array. */
export type EntryType = string | { [key: string]: JsonValue } | JsonValue[] | null;

/** `instructions` is required on every Question, so the SDK's `null` is out. */
export type Entry = Exclude<EntryType, null>;

export type ChoiceCriteria = { [label: string]: EntryType };
export type ScoreCriteria = readonly [EntryType, EntryType, ...EntryType[]];

export interface ChoiceQuestion<T extends ChoiceCriteria = ChoiceCriteria> {
  type: "choice";
  instructions: Entry;
  criteria: T;
}

export interface NoulQuestion {
  type: "noul";
  instructions: Entry;
  criteria?: { true?: EntryType; false?: EntryType };
}

export interface ScoreQuestion<T extends ScoreCriteria = ScoreCriteria> {
  type: "score";
  instructions: Entry;
  criteria: T;
}

export type Question = ChoiceQuestion | NoulQuestion | ScoreQuestion;

export interface Questions {
  [name: string]: Question;
}

export function choice<const T extends ChoiceCriteria>(
  instructions: Entry,
  criteria: T,
): ChoiceQuestion<T> {
  return { type: "choice", instructions, criteria };
}

export function noul(instructions: Entry, criteria?: NoulQuestion["criteria"]): NoulQuestion {
  return criteria ? { type: "noul", instructions, criteria } : { type: "noul", instructions };
}

export function score<const T extends ScoreCriteria>(
  instructions: Entry,
  criteria: T,
): ScoreQuestion<T> {
  return { type: "score", instructions, criteria };
}

const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ]),
);

// Descriptions are typed as the SDK's `EntryType` but parsed as non-null: the spec's schema
// sketch has no `null` in `entry`.
const entry = z.union([z.string().min(1), z.record(z.string(), jsonValue), z.array(jsonValue)]);
const questionName = z.string().regex(/^[a-z][a-z0-9_]*$/);

const choiceQuestion = z
  .object({
    type: z.literal("choice"),
    instructions: entry,
    criteria: z
      .record(z.string().min(1), entry)
      .refine((c) => Object.keys(c).length >= 2, "at least two labels"),
  })
  .strict();

const noulQuestion = z
  .object({
    type: z.literal("noul"),
    instructions: entry,
    criteria: z.object({ true: entry.optional(), false: entry.optional() }).strict().optional(),
  })
  .strict();

// A tuple with a rest, not `z.array(...).min(2)`: the SDK's `ScoreCriteria` is a tuple type,
// and `EntryType[]` would not be assignable to it.
const scoreQuestion = z
  .object({
    type: z.literal("score"),
    instructions: entry,
    criteria: z.tuple([entry, entry], entry),
  })
  .strict();

export const questionSchema = z.discriminatedUnion("type", [
  choiceQuestion,
  noulQuestion,
  scoreQuestion,
]);

export const recipeSchema = z
  .object({
    format: z.literal(1),
    name: z.string().min(1),
    version: z.number().int().min(1),
    model: z
      .string()
      .min(1)
      .refine((m) => m !== "jev-latest" && m !== "jev-preview", "pin a versioned model"),
    reviewThreshold: z.number().min(0).max(1),
    questions: z
      .record(questionName, questionSchema)
      .refine((q) => Object.keys(q).length >= 1, "at least one question"),
  })
  .strict();

/** `questions` is core's `Questions`, not `z.infer`: the parsed shape erases the literals. */
export type Recipe<Q extends Questions = Questions> = Omit<
  z.infer<typeof recipeSchema>,
  "questions"
> & { questions: Q };

export interface DefineRecipeInput<Q extends Questions> {
  name: string;
  version: number;
  model: string;
  reviewThreshold?: number;
  questions: Q;
}

/** Returns the object it built, not `parse`'s copy, whose type is the erased `Recipe`. */
export function defineRecipe<const Q extends Questions>(input: DefineRecipeInput<Q>): Recipe<Q> {
  const recipe: Recipe<Q> = {
    format: 1,
    name: input.name,
    version: input.version,
    model: input.model,
    reviewThreshold: input.reviewThreshold ?? 0.7,
    questions: input.questions,
  };
  recipeSchema.parse(recipe);
  return recipe;
}

export function parseRecipe(text: string): Recipe {
  return recipeSchema.parse(JSON.parse(text));
}

export function serializeRecipe(recipe: Recipe): string {
  const { format, name, version, model, reviewThreshold, questions } = recipe;
  const ordered = { format, name, version, model, reviewThreshold, questions };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
