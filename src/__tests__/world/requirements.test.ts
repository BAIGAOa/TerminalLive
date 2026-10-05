import { describe, it, expect } from "vitest";
import { meetsRequirement, meetsRequirements } from "../../world/requirements.js";
import type Player from "../../world/Player.js";
import type { Requirement } from "../../world/stats.js";

/** Minimal stand-in for Player — meetsRequirement only reads these two getters. */
function player(
  stats: Record<string, number> = {},
  rel: Record<string, number> = {},
): Player {
  return {
    getStat: (k: string) => stats[k] ?? 0,
    getRelationship: (id: string) => rel[id] ?? 0,
  } as unknown as Player;
}

describe("meetsRequirement", () => {
  it("fails closed on a malformed requirement with no target", () => {
    // `{ gte: 999 }` is a content bug, not an always-open gate.
    expect(meetsRequirement(player(), { gte: 999 } as Requirement)).toBe(false);
    expect(meetsRequirement(player(), {} as Requirement)).toBe(false);
  });

  it("gates on a stat with gte / lte", () => {
    const p = player({ health: 70 });
    expect(meetsRequirement(p, { prop: "health", gte: 50 })).toBe(true);
    expect(meetsRequirement(p, { prop: "health", gte: 80 })).toBe(false);
    expect(meetsRequirement(p, { prop: "health", lte: 70 })).toBe(true);
    expect(meetsRequirement(p, { prop: "health", lte: 69 })).toBe(false);
  });

  it("gates on an NPC relationship instead of a stat", () => {
    const p = player({}, { npc_a: 30 });
    expect(meetsRequirement(p, { npc: "npc_a", gte: 20 })).toBe(true);
    expect(meetsRequirement(p, { npc: "npc_a", gte: 40 })).toBe(false);
  });

  it("applies both bounds together", () => {
    const p = player({ money: 500 });
    expect(meetsRequirement(p, { prop: "money", gte: 100, lte: 1000 })).toBe(true);
    expect(meetsRequirement(p, { prop: "money", gte: 600 })).toBe(false);
    expect(meetsRequirement(p, { prop: "money", lte: 400 })).toBe(false);
  });

  it("passes a bare requirement (target present, no bounds)", () => {
    expect(meetsRequirement(player({ health: 1 }), { prop: "health" })).toBe(true);
  });
});

describe("meetsRequirements", () => {
  it("treats an absent or empty requirement list as satisfied", () => {
    expect(meetsRequirements(player(), undefined)).toBe(true);
    expect(meetsRequirements(player(), [])).toBe(true);
  });

  it("requires every requirement to hold", () => {
    const p = player({ health: 70 });
    expect(
      meetsRequirements(p, [
        { prop: "health", gte: 50 },
        { prop: "health", gte: 80 },
      ]),
    ).toBe(false);
    expect(
      meetsRequirements(p, [
        { prop: "health", gte: 50 },
        { prop: "health", lte: 80 },
      ]),
    ).toBe(true);
  });
});
