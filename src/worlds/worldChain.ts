import World from "./World.js";

/**
 * Orders worlds along the unlock tree (a world comes after the worlds it
 * requires via `unlockRequires`), so callers can reason about progression.
 * Roots are worlds with no requirements; dependents are traversed
 * breadth-first from those. `seen` guards against a cyclic tree.
 */
export function sortWorldsLinearly(worlds: World[]): World[] {
  if (worlds.length === 0) return [];
  const byId = new Map<string, World>();
  for (const w of worlds) byId.set(w.id, w);

  // requirement id → ids of the worlds that require it.
  const dependents = new Map<string, string[]>();
  const hasRequires = new Set<string>();
  for (const w of worlds) {
    for (const req of w.unlockRequires) {
      hasRequires.add(w.id);
      if (!dependents.has(req)) dependents.set(req, []);
      dependents.get(req)!.push(w.id);
    }
  }

  const ordered: World[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const w = byId.get(id);
    if (w) ordered.push(w);
    for (const dependent of dependents.get(id) ?? []) visit(dependent);
  };
  for (const w of worlds) {
    if (!hasRequires.has(w.id)) visit(w.id);
  }
  // Worlds unreachable from any root (gated by a missing world) still list.
  for (const w of worlds) {
    if (!seen.has(w.id)) {
      seen.add(w.id);
      ordered.push(w);
    }
  }
  return ordered;
}
