import Level from "./Level.js";

/**
 * Order levels along their `nextLevel` chain starting from the root, so callers
 * can reason about progression (a level is unlocked once its predecessor is
 * completed). Shared by the level-selection screen and the terminal commands.
 */
export function sortLevelsLinearly(levels: Level[]): Level[] {
  if (levels.length === 0) return [];
  const idMap = new Map<string, Level>();
  const childSet = new Set<string>();
  for (const l of levels) {
    idMap.set(l.id, l);
    if (l.nextLevel !== "none") childSet.add(l.nextLevel);
  }
  const root = levels.find((l) => !childSet.has(l.id));
  if (!root) return [...levels].sort((a, b) => a.id.localeCompare(b.id));
  const ordered: Level[] = [];
  const seen = new Set<string>();
  let current: Level | undefined = root;
  // `seen` guards against a cyclic nextLevel chain (e.g. a bad mod).
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    ordered.push(current);
    current =
      current.nextLevel === "none" ? undefined : idMap.get(current.nextLevel);
  }
  return ordered;
}
