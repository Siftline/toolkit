// Type-level assertions. Nothing runs; `typecheck` is the test. Every `@ts-expect-error`
// marks a line that MUST fail to compile, every `Expect<…>` a type that MUST come out exact.
// Each slice of actions appends a section; the helpers below are declared once.

// `Equal` compares two types by the identity of a generic signature, so each `T` is used
// once on purpose — which is what the rule flags.
// oxlint-disable typescript/no-unnecessary-type-parameters

import { defineActions, dispatch } from "@siftline/actions";
import type { ActionId, ActionSet, Dispatched, WebhookConfig } from "@siftline/actions";
import { choice, defineRecipe } from "@siftline/core";
import type { Decision, Recipe, Rule } from "@siftline/core";

type Expect<T extends true> = T;

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

// ─── defineActions ──────────────────────────────────────────────────────────────────────

const actions = defineActions({
  "linear-tickets": { kind: "webhook", config: { url: "https://example.com/tickets" } },
  escalations: { kind: "webhook", config: { url: "https://example.com/escalations" } },
  audit: { kind: "webhook", config: { url: "https://example.com/audit", secret: "s" } },
});

type _Kind = Expect<Equal<(typeof actions)["escalations"]["kind"], "webhook">>;

type _WebhookConfig = Expect<Equal<(typeof actions)["linear-tickets"]["config"], WebhookConfig>>;

type _Accepted = Expect<typeof actions extends ActionSet ? true : false>;

defineActions({
  // @ts-expect-error — `email` is not an Action kind
  mail: { kind: "email", config: { url: "https://example.com/" } },
});

defineActions({
  // @ts-expect-error — a webhook config needs a `url`
  tickets: { kind: "webhook", config: { secret: "s" } },
});

defineActions({
  escalations: {
    kind: "webhook",
    // @ts-expect-error — a webhook config has `url`, `secret` and `headers`, nothing else
    config: { url: "https://example.com/escalations", token: "t" },
  },
});

// ─── dispatch ───────────────────────────────────────────────────────────────────────────

declare const decision: Decision;

declare const recipe: Recipe;

const sent = dispatch(decision, actions, recipe, { signal: new AbortController().signal });

type _Sent = Expect<
  Equal<Awaited<typeof sent>, Dispatched<"linear-tickets" | "escalations" | "audit"> | null>
>;

type _SentAction = Expect<
  Equal<NonNullable<Awaited<typeof sent>>["action"], "linear-tickets" | "escalations" | "audit">
>;

// @ts-expect-error — `dispatch` takes Actions, not a bare config
void dispatch(decision, { tickets: { url: "https://example.com/" } }, recipe);

// @ts-expect-error — only `defineActions` makes an `ActionSet`; a hand-written one is unchecked
void dispatch(decision, { tickets: { kind: "webhook", config: { url: "not a url" } } }, recipe);

void sent;

// ─── ActionId ───────────────────────────────────────────────────────────────────────────

type _ActionIds = Expect<
  Equal<ActionId<typeof actions>, "linear-tickets" | "escalations" | "audit">
>;

type _AnyId = Expect<Equal<ActionId<ActionSet>, string>>;

const inbox = defineRecipe({
  name: "support-inbox",
  version: 1,
  model: "jev-1.13.0",
  questions: {
    category: choice("What is it?", { complaint: "Something is wrong", other: "Anything else" }),
  },
});

const rules: Rule<(typeof inbox)["questions"], ActionId<typeof actions>>[] = [
  {
    id: "complaint",
    condition: { question: "category", comparator: "is", value: "complaint" },
    action: "linear-tickets",
  },
  {
    id: "typo",
    condition: { question: "category", comparator: "is", value: "complaint" },
    // @ts-expect-error — `linear-tikets` is not a defined Action id
    action: "linear-tikets",
  },
  {
    id: "ignore",
    condition: { question: "category", comparator: "is", value: "other" },
    action: null,
  },
];

void rules;
