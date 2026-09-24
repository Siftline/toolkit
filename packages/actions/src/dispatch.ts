import type { Decision, Recipe } from "@siftline/core";

import type { ActionRequest, RecordContext } from "./adapter";
import { adapterFor, isOwnKey } from "./define";
import type { ActionId, ActionSet } from "./define";
import { ActionBuildError } from "./errors";
import { perform } from "./perform";
import type { ActionResponse, PerformOptions } from "./perform";

/** What `dispatch` sent and what came back. */
export interface Dispatched<Id extends string = string> {
  /** The Action id the Decision selected. */
  action: Id;
  request: ActionRequest;
  response: ActionResponse;
}

/**
 * Sends a routed Decision to the Action it selected: builds with that Action's Adapter, then
 * performs once. No retries, no timeout of its own: both belong to the caller, as with
 * `perform`. A send that fails throws `perform`'s `ActionFailedError`, `retryable` intact.
 *
 * @param record The Record the Decision is about, for a Body template's `record.*` variables.
 * @param actions The result of `defineActions`.
 * @returns `null`, sending nothing, when the Decision went to Review or selected no Action.
 * @throws ActionBuildError when the Decision names an Action id not in `actions`.
 */
export async function dispatch<Actions extends ActionSet>(
  decision: Decision,
  record: RecordContext,
  actions: Actions,
  recipe: Recipe,
  options: PerformOptions = {},
): Promise<Dispatched<ActionId<Actions>> | null> {
  const id = decision.action;

  if (decision.review || id === null) return null;

  const definition = isOwnKey(actions, id) ? actions[id] : undefined;

  if (definition === undefined) {
    throw new ActionBuildError(`Decision ${decision.id} selected unknown Action "${id}"`);
  }

  const request = await adapterFor(id, definition.kind).build(
    decision,
    record,
    definition.config,
    recipe,
  );

  const response = await perform(request, options);

  return { action: id, request, response };
}
