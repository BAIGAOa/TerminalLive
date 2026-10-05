import type { MenuEntry } from "./MenuList.js";

/**
 * Navigation helpers shared by {@link MenuList} and {@link ScrollList}. All are
 * pure and skip `disabled` entries (and `undefined` slots), so both list
 * components use exactly the same first/last/step semantics.
 */

/** First selectable index at or after `from`, wrapping around the end. */
export function firstEnabled(items: MenuEntry[], from = 0): number {
  const n = items.length;
  for (let i = from; i < n; i++) if (!items[i]?.disabled) return i;
  for (let i = 0; i < n; i++) if (!items[i]?.disabled) return i;
  return 0;
}

/** Last selectable index (or 0 when every entry is disabled / the list is empty). */
export function lastEnabled(items: MenuEntry[]): number {
  for (let i = items.length - 1; i >= 0; i--) if (!items[i]?.disabled) return i;
  return 0;
}

/**
 * Step `step` from `from`, skipping disabled rows. With `wrap` a boundary
 * folds back modulo the list; without it the move is rejected (returns `from`)
 * at the first row that would leave the list.
 */
export function seek(
  items: MenuEntry[],
  from: number,
  step: number,
  wrap: boolean,
): number {
  const n = items.length;
  if (n === 0 || step === 0) return from;
  let i = from;
  for (let c = 0; c < n; c++) {
    i += step;
    if (i < 0 || i >= n) {
      if (!wrap) return from;
      i = ((i % n) + n) % n;
    }
    if (!items[i]?.disabled) return i;
  }
  return from;
}
