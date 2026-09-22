// Type-level assertions. Nothing runs; `typecheck` is the test. Every `@ts-expect-error`
// marks a line that MUST fail to compile, every `Expect<…>` a type that MUST come out exact.
// Each slice of actions appends a section; the helpers below are declared once.

// `Equal` compares two types by the identity of a generic signature, so each `T` is used
// once on purpose — which is what the rule flags.
// oxlint-disable typescript/no-unnecessary-type-parameters

import { defineActions, dispatch } from "@siftline/actions";
import type {
  ActionDefinitions,
  Dispatched,
  SlackIncomingWebhookConfig,
  WebhookConfig,
} from "@siftline/actions";
import type { Decision, Recipe } from "@siftline/core";

type Expect<T extends true> = T;

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

// ─── defineActions ──────────────────────────────────────────────────────────────────────

const actions = defineActions({
  "linear-tickets": { kind: "webhook", config: { url: "https://example.com/tickets" } },
  escalations: {
    kind: "slack_incoming_webhook",
    config: { url: "https://hooks.slack.com/services/T0/B0/X" },
  },
  audit: { kind: "webhook", config: { url: "https://example.com/audit", secret: "s" } },
});

type _Ids = Expect<Equal<keyof typeof actions, "linear-tickets" | "escalations" | "audit">>;

type _Kind = Expect<Equal<(typeof actions)["escalations"]["kind"], "slack_incoming_webhook">>;

type _WebhookConfig = Expect<Equal<(typeof actions)["linear-tickets"]["config"], WebhookConfig>>;

type _SlackConfig = Expect<
  Equal<(typeof actions)["escalations"]["config"], SlackIncomingWebhookConfig>
>;

type _Accepted = Expect<typeof actions extends ActionDefinitions ? true : false>;

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
    kind: "slack_incoming_webhook",
    // @ts-expect-error — Slack's config is `{ url }` and nothing else
    config: { url: "https://hooks.slack.com/services/T0/B0/X", secret: "s" },
  },
});

// ─── dispatch ───────────────────────────────────────────────────────────────────────────

declare const decision: Decision;

declare const recipe: Recipe;

const sent = dispatch(decision, actions, recipe, { signal: new AbortController().signal });

type _Sent = Expect<Equal<Awaited<typeof sent>, Dispatched | null>>;

// @ts-expect-error — `dispatch` takes Actions, not a bare config
void dispatch(decision, { tickets: { url: "https://example.com/" } }, recipe);

void sent;
