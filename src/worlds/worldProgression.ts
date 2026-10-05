import World from "./World.js";
import { sortWorldsLinearly } from "./worldChain.js";

/**
 * Pure level-progression logic: unlock graph, statuses, ordering and branch
 * resolution. No React, no container — so it is fully unit-testable and the UI
 * stays a thin renderer over its output.
 */

export type WorldStatus = "locked" | "unlocked" | "completed";

export interface WorldEntry {
  level: World;
  status: WorldStatus;
  /** Position along the progression order. */
  index: number;
}

/** worldId → ids of the worlds it requires to be completed (the unlock tree). */
export function predecessorsOf(levels: World[]): Map<string, Set<string>> {
  const preds = new Map<string, Set<string>>();
  for (const world of levels) {
    if (world.unlockRequires.length === 0) continue;
    preds.set(world.id, new Set(world.unlockRequires));
  }
  return preds;
}

/**
 * Status per level: completed if finished; otherwise unlocked when it has no
 * predecessors, or at least one predecessor is completed; else locked.
 */
export function computeStatuses(
  levels: World[],
  completed: ReadonlySet<string>,
): Map<string, WorldStatus> {
  const preds = predecessorsOf(levels);
  const statuses = new Map<string, WorldStatus>();
  for (const level of levels) {
    if (completed.has(level.id)) {
      statuses.set(level.id, "completed");
      continue;
    }
    const incoming = preds.get(level.id);
    // A world unlocks once EVERY world it requires has been completed.
    const open =
      !incoming || incoming.size === 0 || [...incoming].every((id) => completed.has(id));
    statuses.set(level.id, open ? "unlocked" : "locked");
  }
  return statuses;
}

/** Levels in progression order, each tagged with its status. */
export function worldEntries(
  levels: World[],
  completed: ReadonlySet<string>,
): WorldEntry[] {
  const statuses = computeStatuses(levels, completed);
  return sortWorldsLinearly(levels).map((level, index) => ({
    level,
    index,
    status: statuses.get(level.id) ?? "locked",
  }));
}

/** The first unlocked, not-yet-completed world — what "continue" should open. */
export function nextRecommended(entries: WorldEntry[]): WorldEntry | null {
  return entries.find((e) => e.status === "unlocked") ?? null;
}

/** Group consecutive entries into acts (by an optional `act` label). */
export function groupByAct(entries: WorldEntry[]): Array<{
  act: string;
  entries: WorldEntry[];
}> {
  const groups: Array<{ act: string; entries: WorldEntry[] }> = [];
  for (const entry of entries) {
    const act = entry.level.act ?? "default";
    const last = groups[groups.length - 1];
    if (last && last.act === act) last.entries.push(entry);
    else groups.push({ act, entries: [entry] });
  }
  return groups;
}

/** Group worlds by theme tag (a world may appear under several tags). */
export function groupByTag(entries: WorldEntry[]): Array<{
  tag: string;
  entries: WorldEntry[];
}> {
  const groups = new Map<string, WorldEntry[]>();
  for (const entry of entries) {
    const tags = entry.level.tags.length > 0 ? entry.level.tags : ["misc"];
    for (const tag of tags) {
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag)!.push(entry);
    }
  }
  return [...groups.entries()].map(([tag, entries]) => ({ tag, entries }));
}
