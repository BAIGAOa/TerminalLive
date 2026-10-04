import { describe, it, expect } from "vitest";
import Level from "../../level/Level.js";
import LevelCondition from "../../level/LevelCondition.js";
import {
  computeStatuses,
  groupByAct,
  levelEntries,
  nextRecommended,
  predecessorsOf,
  resolveBranch,
} from "../../level/levelProgression.js";

function node(
  id: string,
  nextLevel: string,
  opts: {
    branches?: Array<{ levelId: string; requires: LevelCondition[] }>;
    act?: string;
    player?: unknown;
  } = {},
): Level {
  return {
    id,
    nextLevel,
    nextBranches: opts.branches ?? [],
    act: opts.act,
    player: opts.player ?? {},
  } as unknown as Level;
}

const cond = (v: boolean): LevelCondition =>
  ({ customsClearance: () => v }) as unknown as LevelCondition;

describe("predecessorsOf", () => {
  it("maps both linear and branching edges", () => {
    const levels = [
      node("a", "none", {
        branches: [
          { levelId: "b", requires: [] },
          { levelId: "c", requires: [] },
        ],
      }),
      node("b", "none"),
      node("c", "d"),
      node("d", "none"),
    ];
    const preds = predecessorsOf(levels);
    expect([...preds.get("b")!]).toEqual(["a"]);
    expect([...preds.get("c")!]).toEqual(["a"]);
    expect([...preds.get("d")!]).toEqual(["c"]);
    expect(preds.get("a")).toBeUndefined();
  });
});

describe("computeStatuses", () => {
  it("unlocks the successor of a completed level, locks the rest", () => {
    const levels = [node("a", "b"), node("b", "c"), node("c", "none")];
    const s = computeStatuses(levels, new Set(["a"]));
    expect(s.get("a")).toBe("completed");
    expect(s.get("b")).toBe("unlocked");
    expect(s.get("c")).toBe("locked");
  });

  it("unlocks every branch when the fork is completed", () => {
    const levels = [
      node("a", "none", {
        branches: [
          { levelId: "b", requires: [] },
          { levelId: "c", requires: [] },
        ],
      }),
      node("b", "none"),
      node("c", "none"),
    ];
    const s = computeStatuses(levels, new Set(["a"]));
    expect(s.get("b")).toBe("unlocked");
    expect(s.get("c")).toBe("unlocked");
  });

  it("treats a predecessor-less root as unlocked", () => {
    const s = computeStatuses([node("root", "none")], new Set());
    expect(s.get("root")).toBe("unlocked");
  });
});

describe("levelEntries + nextRecommended", () => {
  it("orders by progression and recommends the first unlocked level", () => {
    const levels = [node("a", "b"), node("b", "c"), node("c", "none")];
    const entries = levelEntries(levels, new Set(["a"]));
    expect(entries.map((e) => e.level.id)).toEqual(["a", "b", "c"]);
    expect(entries.map((e) => e.status)).toEqual([
      "completed",
      "unlocked",
      "locked",
    ]);
    expect(nextRecommended(entries)?.level.id).toBe("b");
  });
});

describe("resolveBranch", () => {
  it("returns the first satisfied branch", () => {
    const level = node("a", "fallback", {
      branches: [
        { levelId: "x", requires: [cond(false)] },
        { levelId: "y", requires: [cond(true)] },
      ],
    });
    expect(resolveBranch(level)).toBe("y");
  });

  it("falls back to the linear next level", () => {
    expect(resolveBranch(node("a", "b"))).toBe("b");
  });

  it("returns null when there is nowhere to go", () => {
    expect(resolveBranch(node("a", "none"))).toBeNull();
  });
});

describe("groupByAct", () => {
  it("groups consecutive entries by act", () => {
    const levels = [
      node("a", "b", { act: "I" }),
      node("b", "c", { act: "I" }),
      node("c", "none", { act: "II" }),
    ];
    const groups = groupByAct(levelEntries(levels, new Set()));
    expect(groups.map((g) => g.act)).toEqual(["I", "II"]);
    expect(groups[0].entries).toHaveLength(2);
  });
});
