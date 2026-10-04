import Level from "./Level.js";

/**
 * Order levels along their `nextLevel`/branch chain from the root(s), so callers
 * can reason about progression (a level is unlocked once its predecessor is
 * completed). Branching successors are traversed breadth-first; `seen` guards
 * against a cyclic chain (e.g. a bad mod). Shared by the selection screen and
 * the terminal commands.
 */
export function sortLevelsLinearly(levels: Level[]): Level[] {
  if (levels.length === 0) return [];
  const idMap = new Map<string, Level>();
  const childSet = new Set<string>();
  for (const l of levels) {
    idMap.set(l.id, l);
    if (l.nextLevel !== "none") childSet.add(l.nextLevel);
    for (const b of l.nextBranches) childSet.add(b.levelId);
  }
  const roots = levels.filter((l) => !childSet.has(l.id));
  if (roots.length === 0) {
    return [...levels].sort((a, b) => a.id.localeCompare(b.id));
  }

  const ordered: Level[] = [];
  const seen = new Set<string>();
  const queue: Level[] = [...roots];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current.id)) continue;
    seen.add(current.id);
    ordered.push(current);
    const successors = [
      current.nextLevel !== "none" ? current.nextLevel : null,
      ...current.nextBranches.map((b) => b.levelId),
    ];
    for (const id of successors) {
      const next = id ? idMap.get(id) : undefined;
      if (next && !seen.has(next.id)) queue.push(next);
    }
  }
  // Levels unreachable from any root (disconnected mods) still get listed.
  for (const l of levels) {
    if (!seen.has(l.id)) {
      seen.add(l.id);
      ordered.push(l);
    }
  }
  return ordered;
}
