import type { ActionKind } from "./adapter";
import { webhook } from "./webhook";

/** Every Adapter, keyed by cloud's `action.kind`. */
export const adapters = {
  webhook,
  // Exhaustive over `ActionKind`: a new kind without an Adapter fails to compile.
} satisfies { [K in ActionKind]: { kind: ActionKind } };
