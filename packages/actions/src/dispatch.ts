import type { Decision, Recipe } from "@siftline/core";

import type { ActionRequest } from "./adapter";
import { buildAction } from "./define";
import type { ActionDefinitions } from "./define";
import { ActionBuildError } from "./errors";
import { perform } from "./perform";
import type { ActionResponse, PerformOptions } from "./perform";

/** What `dispatch` sent and what came back. */
export interface Dispatched {
  /** The Action id the Decision selected. */
  action: string;
  request: ActionRequest;
  response: ActionResponse;
}

/**
 * Sends a routed Decision to the Action it selected: builds with that Action's Adapter, then
 * performs once. No retries, no timeout of its own: both belong to the caller, as with
 * `perform`. A send that fails throws `perform`'s `ActionFailedError`, `retryable` intact.
 *
 * @returns `null`, sending nothing, when the Decision went to Review or selected no Action.
 * @throws ActionBuildError when the Decision names an Action id not in `actions`.
 */
export async function dispatch(
  decision: Decision,
  actions: ActionDefinitions,
  recipe: Recipe,
  options: PerformOptions = {},
): Promise<Dispatched | null> {
  const id = decision.action;

  if (decision.review || id === null) return null;

  // Own keys only: an id such as "toString" is not an Action.
  const definition = Object.hasOwn(actions, id) ? actions[id] : undefined;

  if (definition === undefined) {
    throw new ActionBuildError(`Decision ${decision.id} selected unknown Action "${id}"`);
  }

  const request = await buildAction(id, definition.kind, definition.config, decision, recipe);
  const response = await perform(request, options);

  return { action: id, request, response };
}
