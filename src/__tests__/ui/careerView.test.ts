import { describe, it, expect } from "vitest";
import { careerRequirementsMet } from "../../world/careers/careerView.js";
import type Player from "../../world/Player.js";
import type { CareerRank } from "../../world/careers/CareerDefinition.js";

function fakePlayer(
  stats: Record<string, number>,
  rels: Record<string, number>,
): Player {
  return {
    getStat: (k: string) => stats[k] ?? 0,
    getRelationship: (id: string) => rels[id] ?? 0,
  } as unknown as Player;
}

const rank = (requires: CareerRank["requires"]): CareerRank => ({
  titleKey: "t",
  salary: 0,
  requires,
});

describe("careerRequirementsMet", () => {
  it("resolves stat gates and relationship gates against the player", () => {
    const player = fakePlayer({ health: 60, money: 200 }, { alice: 80 });
    const out = careerRequirementsMet(
      player,
      rank([
        { prop: "health", gte: 50 },
        { prop: "money", lte: 100 },
        { npc: "alice", gte: 70 },
      ]),
    );

    expect(out).toEqual([
      { prop: "health", npc: null, value: 60, need: 50, met: true },
      { prop: "money", npc: null, value: 200, need: 100, met: false },
      { prop: null, npc: "alice", value: 80, need: 70, met: true },
    ]);
  });

  it("treats a targetless requirement as 0 against a 0 threshold", () => {
    const out = careerRequirementsMet(fakePlayer({}, {}), rank([{}]));
    expect(out[0]).toEqual({
      prop: null,
      npc: null,
      value: 0,
      need: 0,
      met: true,
    });
  });

  it("returns an empty list when there are no requirements", () => {
    expect(careerRequirementsMet(fakePlayer({}, {}), rank([]))).toEqual([]);
  });
});
