import type { ActionKind, Adapter } from "./adapter";
import { adapters } from "./adapters";
import { ActionBuildError } from "./errors";
import type { SlackIncomingWebhookConfig } from "./slack";
import type { WebhookConfig } from "./webhook";

interface ConfigByKind {
  webhook: WebhookConfig;
  slack_incoming_webhook: SlackIncomingWebhookConfig;
}

type KindById = { [id: string]: ActionKind };

type ActionEntries<Kinds extends KindById> = {
  [Id in keyof Kinds]: { kind: Kinds[Id]; config: ConfigByKind[Kinds[Id]] };
};

declare const checked: unique symbol;

/**
 * What `defineActions` returns: each Action id, kept literal, with its kind and its parsed
 * config. Only `defineActions` makes one, so `dispatch` never sends an unchecked config.
 */
export type ActionSet<Kinds extends KindById = KindById> = ActionEntries<Kinds> & {
  /** Exists only in the type: the proof that `defineActions` parsed every config. */
  readonly [checked]: true;
};

/**
 * The Action ids of a `defineActions` result, as a union of literals. Pass it as the second
 * argument to `Rule`, `Rule<Questions, ActionId<typeof actions>>`, so a Rule naming an Action
 * you did not define fails to compile.
 */
export type ActionId<Actions extends ActionSet> = keyof Actions & string;

// Own keys only: an inherited name such as `toString` is neither an Action id nor an Action kind.
export function isOwnKey<Owner extends object>(owner: Owner, key: PropertyKey): key is keyof Owner {
  return Object.hasOwn(owner, key);
}

// Written as a mapped type so that indexing it with a generic kind keeps the config paired with
// its Adapter. Also fails to compile if `ConfigByKind` misses a kind.
const byKind: { [K in ActionKind]: Adapter<ConfigByKind[K]> } = adapters;

export function adapterFor<K extends ActionKind>(id: string, kind: K): Adapter<ConfigByKind[K]> {
  if (isOwnKey(byKind, kind)) return byKind[kind];

  // `String`: the guard narrows `kind` to `never` here, but a JavaScript caller can pass anything.
  throw new ActionBuildError(`Action "${id}": unknown Action kind "${String(kind)}"`);
}

/**
 * Declares named Actions. Parses every config with its kind's `configSchema` now, so a bad
 * config fails at startup rather than on the first Decision that selects it.
 *
 * @throws ActionBuildError naming the Action id: an empty id, an unknown kind, or the first
 *   problem with a config.
 */
export function defineActions<const Kinds extends KindById>(
  definitions: ActionEntries<Kinds>,
): ActionSet<Kinds> {
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
  // from the one given; the schemas are strict and transform nothing. The `checked` brand exists
  // only in the type, and this is the one place that grants it.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Object.fromEntries(parsed) as ActionSet<Kinds>;
}
