import type { KeyAction } from "../core/registry/KeyActionRegistry.js";

/** Pure key-binding maths, React-free and testable. */

export type { KeyAction };

/**
 * Merge saved bindings over an action's default.
 *
 * An empty string means "cleared" and falls back to the default — a space is a
 * valid key and is kept, so the distinction has to be `""` rather than falsy.
 */
export function resolveKeymap(
  saved: Record<string, string> | undefined,
  actions: readonly KeyAction[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const action of actions) {
    const savedKey = saved?.[action.id];
    out[action.id] =
      savedKey === undefined || savedKey === "" ? action.defaultKey : savedKey;
  }
  return out;
}

/**
 * The key names to bind for an action.
 *
 * A single character arrives as a different name depending on Shift (`s` and
 * `S` are separate names), so both are bound — otherwise a player who binds `s`
 * finds it stops working the moment they hold Shift. Named keys (`left`,
 * `pagedown`) have no shifted form and are bound as they are.
 */
export function bindingsFor(key: string): string[] {
  if (key.length !== 1) return [key];
  const upper = key.toUpperCase();
  return upper === key ? [key] : [key, upper];
}

/**
 * Which actions share a key with which others.
 *
 * Only actions that are actually in the map count, and an action never
 * conflicts with itself. Empty when every key is unique (the common case), so
 * callers can treat a non-empty result as "show a warning".
 */
export function findConflicts(
  actions: readonly KeyAction[],
  keymap: Record<string, string>,
): Record<string, string[]> {
  // Grouped case-insensitively: a single-character binding claims both cases
  // at runtime (`bindingsFor`), so `s` and `S` are one shortcut and have to be
  // reported as one collision rather than silently sharing a key.
  const byKey = new Map<string, string[]>();
  for (const action of actions) {
    const key = keymap[action.id];
    if (!key) continue;
    const shared = key.length === 1 ? key.toLowerCase() : key;
    const list = byKey.get(shared) ?? [];
    list.push(action.id);
    byKey.set(shared, list);
  }

  const conflicts: Record<string, string[]> = {};
  for (const ids of byKey.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) conflicts[id] = ids.filter((other) => other !== id);
  }
  return conflicts;
}
