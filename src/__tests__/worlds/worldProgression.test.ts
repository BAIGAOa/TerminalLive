import { describe, it, expect } from "vitest";
import World from "../../worlds/World.js";
import {
  computeStatuses,
  groupByTag,
  worldEntries,
  nextRecommended,
  predecessorsOf,
} from "../../worlds/worldProgression.js";

function node(
  id: string,
  unlockRequires: string[] = [],
  opts: { tags?: string[]; act?: string } = {},
): World {
  return {
    id,
    unlockRequires,
    tags: opts.tags ?? [],
    act: opts.act,
  } as unknown as World;
}

describe("predecessorsOf", () => {
  it("maps unlock requirements", () => {
    const worlds = [node("a"), node("b", ["a"]), node("c", ["a"]), node("d", ["c"])];
    const preds = predecessorsOf(worlds);
    expect([...preds.get("b")!]).toEqual(["a"]);
    expect([...preds.get("d")!]).toEqual(["c"]);
    expect(preds.get("a")).toBeUndefined();
  });
});

describe("computeStatuses", () => {
  it("unlocks a world once its requirement is completed", () => {
    const worlds = [node("a"), node("b", ["a"]), node("c", ["b"])];
    const s = computeStatuses(worlds, new Set(["a"]));
    expect(s.get("a")).toBe("completed");
    expect(s.get("b")).toBe("unlocked");
    expect(s.get("c")).toBe("locked");
  });

  it("treats a requirement-free root as unlocked", () => {
    expect(computeStatuses([node("root")], new Set()).get("root")).toBe("unlocked");
  });

  it("keeps a world locked until ALL its requirements are done", () => {
    const worlds = [node("a"), node("b"), node("c", ["a", "b"])];
    expect(computeStatuses(worlds, new Set(["a"])).get("c")).toBe("locked");
    expect(computeStatuses(worlds, new Set(["a", "b"])).get("c")).toBe("unlocked");
  });
});

describe("worldEntries + nextRecommended", () => {
  it("orders by the tree and recommends the first unlocked world", () => {
    const worlds = [node("a"), node("b", ["a"]), node("c", ["b"])];
    const entries = worldEntries(worlds, new Set(["a"]));
    expect(entries.map((e) => e.level.id)).toEqual(["a", "b", "c"]);
    expect(entries.map((e) => e.status)).toEqual([
      "completed",
      "unlocked",
      "locked",
    ]);
    expect(nextRecommended(entries)?.level.id).toBe("b");
  });
});

describe("groupByTag", () => {
  it("groups worlds by theme tag (a world may appear under several)", () => {
    const worlds = [
      node("a", [], { tags: ["harsh"] }),
      node("b", [], { tags: ["harsh", "order"] }),
    ];
    const groups = groupByTag(worldEntries(worlds, new Set()));
    expect(
      groups.find((g) => g.tag === "harsh")?.entries.map((e) => e.level.id),
    ).toEqual(["a", "b"]);
    expect(
      groups.find((g) => g.tag === "order")?.entries.map((e) => e.level.id),
    ).toEqual(["b"]);
  });
});
