/**
 * A closed player-age interval. Both bounds are inclusive and optional: an
 * absent bound means "unbounded on that side". Pure data + pure predicates, so
 * the age-gating rules are unit-testable with no React/DI in the way.
 */
export interface AgeWindow {
  min?: number;
  max?: number;
}

/** Whether `age` falls inside `w` (an absent window is unbounded). */
export function inWindow(age: number, w: AgeWindow | undefined): boolean {
  if (!w) return true;
  if (w.min !== undefined && age < w.min) return false;
  if (w.max !== undefined && age > w.max) return false;
  return true;
}

/**
 * Merge a definition's own `minAge`/`maxAge` over a fallback window: the def's
 * explicit bound always wins, otherwise the window's bound applies. Returns a
 * shallow copy so shared role tables (e.g. RelationshipContent's autonomy
 * lists) are never mutated.
 */
export function stampWindow<T extends { minAge?: number; maxAge?: number }>(
  def: T,
  window: AgeWindow | undefined,
): T {
  if (!window) return def;
  return {
    ...def,
    minAge: def.minAge ?? window.min,
    maxAge: def.maxAge ?? window.max,
  };
}
