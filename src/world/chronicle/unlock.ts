import { KarmaAxis, KarmaState } from "./karma.js";

/**
 * A condition over the evolving world state, used to unlock lore and fate
 * arcs. Supports nesting via `all` / `any`.
 */
export type UnlockCondition =
  | { kind: "era"; era: string }
  | { kind: "faction"; faction: string; min: number }
  | { kind: "karma"; axis: KarmaAxis; gte?: number; lte?: number }
  | { kind: "year"; year: number }
  | { kind: "flag"; flag: string }
  | { kind: "all"; of: UnlockCondition[] }
  | { kind: "any"; of: UnlockCondition[] };

/** The slice of world state a condition is evaluated against. */
export interface ChronicleContext {
  year: number;
  eraId: string;
  karma: KarmaState;
  standing: Map<string, number>;
  flags: Set<string>;
}

export function meetsUnlock(
  cond: UnlockCondition,
  ctx: ChronicleContext,
): boolean {
  // Un-validated content (a mod entry missing `unlock`) must degrade to
  // "locked", not throw a TypeError on the first unlock pass.
  if (!cond || typeof cond.kind !== "string") return false;
  switch (cond.kind) {
    case "era":
      return ctx.eraId === cond.era;
    case "faction":
      return (ctx.standing.get(cond.faction) ?? 0) >= cond.min;
    case "karma": {
      const v = ctx.karma[cond.axis];
      if (cond.gte !== undefined && v < cond.gte) return false;
      if (cond.lte !== undefined && v > cond.lte) return false;
      return true;
    }
    case "year":
      return ctx.year >= cond.year;
    case "flag":
      return ctx.flags.has(cond.flag);
    case "all":
      return cond.of.every((c) => meetsUnlock(c, ctx));
    case "any":
      return cond.of.some((c) => meetsUnlock(c, ctx));
    default:
      return false;
  }
}
