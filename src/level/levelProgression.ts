import Level from "./Level.js";
import { sortLevelsLinearly } from "./levelChain.js";

/**
 * Pure level-progression logic: unlock graph, statuses, ordering and branch
 * resolution. No React, no container — so it is fully unit-testable and the UI
 * stays a thin renderer over its output.
 */

export type LevelStatus = "locked" | "unlocked" | "completed";

export interface LevelEntry {
  level: Level;
  status: LevelStatus;
  /** Position along the progression order. */
  index: number;
}

/** levelId → ids of the levels that lead into it (via nextLevel or a branch). */
export function predecessorsOf(levels: Level[]): Map<string, Set<string>> {
  const preds = new Map<string, Set<string>>();
  const add = (from: string, to: string) => {
    if (!preds.has(to)) preds.set(to, new Set());
    preds.get(to)!.add(from);
  };
  for (const level of levels) {
    if (level.nextLevel !== "none") add(level.id, level.nextLevel);
    for (const branch of level.nextBranches) add(level.id, branch.levelId);
  }
  return preds;
}

/**
 * Status per level: completed if finished; otherwise unlocked when it has no
 * predecessors, or at least one predecessor is completed; else locked.
 */
export function computeStatuses(
  levels: Level[],
  completed: ReadonlySet<string>,
): Map<string, LevelStatus> {
  const preds = predecessorsOf(levels);
  const statuses = new Map<string, LevelStatus>();
  for (const level of levels) {
    if (completed.has(level.id)) {
      statuses.set(level.id, "completed");
      continue;
    }
    const incoming = preds.get(level.id);
    const open =
      !incoming || incoming.size === 0 || [...incoming].some((id) => completed.has(id));
    statuses.set(level.id, open ? "unlocked" : "locked");
  }
  return statuses;
}

/** Levels in progression order, each tagged with its status. */
export function levelEntries(
  levels: Level[],
  completed: ReadonlySet<string>,
): LevelEntry[] {
  const statuses = computeStatuses(levels, completed);
  return sortLevelsLinearly(levels).map((level, index) => ({
    level,
    index,
    status: statuses.get(level.id) ?? "locked",
  }));
}

/**
 * The next level a run should head to: the first branch whose requirements are
 * met, else the linear `nextLevel`, else null. Pure over the level's own player.
 */
export function resolveBranch(level: Level): string | null {
  for (const branch of level.nextBranches) {
    if (branch.requires.every((c) => c.customsClearance(level.player))) {
      return branch.levelId;
    }
  }
  return level.nextLevel === "none" ? null : level.nextLevel;
}

/** The first unlocked, not-yet-completed level — what "continue" should open. */
export function nextRecommended(entries: LevelEntry[]): LevelEntry | null {
  return entries.find((e) => e.status === "unlocked") ?? null;
}

/** Group consecutive entries into acts (by an optional `act` label). */
export function groupByAct(entries: LevelEntry[]): Array<{
  act: string;
  entries: LevelEntry[];
}> {
  const groups: Array<{ act: string; entries: LevelEntry[] }> = [];
  for (const entry of entries) {
    const act = entry.level.act ?? "default";
    const last = groups[groups.length - 1];
    if (last && last.act === act) last.entries.push(entry);
    else groups.push({ act, entries: [entry] });
  }
  return groups;
}
