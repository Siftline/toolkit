import type { Decision, Recipe } from "@siftline/core";

import type { ActionKind, ActionRequest, Adapter } from "./adapter";
import { adapters } from "./adapters";
import { ActionBuildError } from "./errors";
import type { SlackIncomingWebhookConfig } from "./slack";
import type { WebhookConfig } from "./webhook";

/** Each Action kind's config, as its Adapter's `configSchema` parses it. */
export interface ActionConfigs {
  webhook: WebhookConfig;
  slack_incoming_webhook: SlackIncomingWebhookConfig;
}

/** One Action: an Action kind and a config for that kind's Adapter. */
export type ActionDefinition = {
  [K in ActionKind]: { kind: K; config: ActionConfigs[K] };
}[ActionKind];

/** Actions keyed by Action id. A Rule names one by that id; the kind says how it is sent. */
export interface ActionDefinitions {
  readonly [id: string]: ActionDefinition;
}

/** What `defineActions` returns: each Action id, kept literal, with its kind and config. */
export type DefinedActions<Kinds extends { [id: string]: ActionKind }> = {
  [Id in keyof Kinds]: { kind: Kinds[Id]; config: ActionConfigs[Kinds[Id]] };
};

// Written as a mapped type so that indexing it with a generic kind keeps the config paired with
// its Adapter. Also fails to compile if `ActionConfigs` misses a kind.
const byKind: { [K in ActionKind]: Adapter<ActionConfigs[K]> } = adapters;

// Own keys only: `adapters.toString` is not an Adapter.
function adapterFor<K extends ActionKind>(id: string, kind: K): Adapter<ActionConfigs[K]> {
  if (!Object.hasOwn(adapters, kind)) {
    throw new ActionBuildError(`Action "${id}": unknown Action kind "${kind}"`);
  }

  return byKind[kind];
}

/** Builds the request for one defined Action. `dispatch` is the only caller. */
export function buildAction<K extends ActionKind>(
  id: string,
  kind: K,
  config: ActionConfigs[K],
  decision: Decision,
  recipe: Recipe,
): Promise<ActionRequest> {
  return adapterFor(id, kind).build(decision, config, recipe);
}

/**
 * Declares named Actions. Parses every config with its kind's `configSchema` now, so a bad
 * config fails at startup rather than on the first Decision that selects it.
 *
 * @throws ActionBuildError naming the Action id: an empty id, an unknown kind, or the first
 *   problem with a config.
 */
export function defineActions<const Kinds extends { [id: string]: ActionKind }>(
  definitions: DefinedActions<Kinds>,
): DefinedActions<Kinds> {
  const parsed = Object.entries(definitions).map(([id, definition]) => {
    if (id === "") throw new ActionBuildError("An Action id must be a non-empty string");

    const result = adapterFor(id, definition.kind).configSchema.safeParse(definition.config);

    if (!result.success) {
      const [first] = result.error.issues;
      const where = ["config", ...(first?.path ?? [])].map(String).join(".");

      throw new ActionBuildError(`Action "${id}": ${where}: ${first?.message ?? "invalid"}`, {
        cause: result.error,
      });
    }

    return [id, { kind: definition.kind, config: result.data }] as const;
  });

  // SAFETY: every entry keeps its id and kind, and its config is what that kind's schema parsed
  // from the one given; the schemas are strict and transform nothing.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Object.fromEntries(parsed) as DefinedActions<Kinds>;
}
