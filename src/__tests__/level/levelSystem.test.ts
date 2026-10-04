import { describe, it, expect } from "vitest";
import { sortLevelsLinearly } from "../../level/levelChain.js";
import { difficultyModifier } from "../../level/DifficultyModifier.js";
import Level from "../../level/Level.js";
import Player from "../../world/Player.js";
import LevelRecordsStore from "../../core/store/LevelRecordsStore.js";

/** Minimal level stand-in for chain ordering (only id/nextLevel/branches read). */
function node(
  id: string,
  nextLevel: string,
  branches: Array<{ levelId: string; requires: [] }> = [],
): Level {
  return { id, nextLevel, nextBranches: branches } as unknown as Level;
}

describe("levelChain (branching)", () => {
  it("walks branches breadth-first from the root", () => {
    const levels = [
      node("a", "none", [
        { levelId: "b", requires: [] },
        { levelId: "c", requires: [] },
      ]),
      node("b", "none"),
      node("c", "d"),
      node("d", "none"),
    ];
    expect(sortLevelsLinearly(levels).map((l) => l.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("appends levels unreachable from any root", () => {
    const levels = [node("root", "none"), node("orphan", "none")];
    const ids = sortLevelsLinearly(levels).map((l) => l.id);
    expect(ids).toContain("root");
    expect(ids).toContain("orphan");
  });
});

describe("difficulty modifiers", () => {
  it("shifts the starting state on harder tiers", () => {
    const player = new Player({
      playerName: "T",
      age: 30,
      health: 80,
      happiness: 60,
      money: 100,
    });
    const mod = difficultyModifier("hard");
    if (mod.statAdd) player.applyDelta(mod.statAdd);
    if (mod.moneyMul !== undefined) {
      player.setStat("money", Math.floor(player.money * mod.moneyMul));
    }
    expect(player.health).toBe(72);
    expect(player.happiness).toBe(54);
    expect(player.money).toBe(60);
    expect(mod.flag).toBe("diff_hard");
  });

  it("falls back to a tagged no-op for unknown tiers", () => {
    expect(difficultyModifier("weird").statAdd).toBeUndefined();
    expect(difficultyModifier("weird").flag).toBe("diff_weird");
  });
});

class FakePersistence {
  data: unknown = null;
  async loadingConfig(schema?: { parse: (d: unknown) => unknown }) {
    if (this.data === null) throw new Error("missing");
    return schema ? schema.parse(this.data) : this.data;
  }
  async saveConfig(data: unknown, schema?: { parse: (d: unknown) => unknown }) {
    if (schema) schema.parse(data);
    this.data = JSON.parse(JSON.stringify(data));
  }
}

describe("LevelRecordsStore (meta progression)", () => {
  it("defaults to an empty record", async () => {
    const store = new LevelRecordsStore(new FakePersistence() as never);
    await store.init();
    expect(store.getRecord("childhood").completions).toBe(0);
    expect(store.getRecord("childhood").medals).toEqual([]);
  });

  it("accumulates completions and keeps the best score", async () => {
    const store = new LevelRecordsStore(new FakePersistence() as never);
    await store.init();
    await store.recordCompletion("childhood", 120, "complete");
    await store.recordCompletion("childhood", 90, "death");
    const rec = store.getRecord("childhood");
    expect(rec.completions).toBe(2);
    expect(rec.bestScore).toBe(120);
    expect(rec.lastOutcome).toBe("death");
  });

  it("records each medal once and persists across instances", async () => {
    const fake = new FakePersistence();
    const a = new LevelRecordsStore(fake as never);
    await a.init();
    await a.addMedal("childhood", "ob_child_reader");
    await a.addMedal("childhood", "ob_child_reader");
    expect(a.getRecord("childhood").medals).toEqual(["ob_child_reader"]);

    const b = new LevelRecordsStore(fake as never);
    await b.init();
    expect(b.getRecord("childhood").medals).toEqual(["ob_child_reader"]);
  });
});
