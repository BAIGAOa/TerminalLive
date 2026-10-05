import { describe, it, expect } from "vitest";
import { sortWorldsLinearly } from "../../worlds/worldChain.js";
import { difficultyModifier } from "../../worlds/DifficultyModifier.js";
import World from "../../worlds/World.js";
import Player from "../../world/Player.js";
import WorldRecordsStore from "../../core/store/WorldRecordsStore.js";

/** Minimal world stand-in for tree ordering (only id/unlockRequires read). */
function node(id: string, unlockRequires: string[] = []): World {
  return { id, unlockRequires } as unknown as World;
}

describe("worldChain (unlock tree)", () => {
  it("orders a world after the worlds it requires", () => {
    const worlds = [
      node("a"),
      node("b", ["a"]),
      node("c", ["a"]),
      node("d", ["c"]),
    ];
    expect(sortWorldsLinearly(worlds).map((w) => w.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("appends worlds unreachable from any root", () => {
    const worlds = [node("root"), node("orphan", ["ghost"])];
    const ids = sortWorldsLinearly(worlds).map((w) => w.id);
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

describe("WorldRecordsStore (meta progression)", () => {
  it("defaults to an empty record", async () => {
    const store = new WorldRecordsStore(new FakePersistence() as never);
    await store.init();
    expect(store.getRecord("childhood").completions).toBe(0);
    expect(store.getRecord("childhood").medals).toEqual([]);
  });

  it("accumulates completions and keeps the best score", async () => {
    const store = new WorldRecordsStore(new FakePersistence() as never);
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
    const a = new WorldRecordsStore(fake as never);
    await a.init();
    await a.addMedal("childhood", "ob_child_reader");
    await a.addMedal("childhood", "ob_child_reader");
    expect(a.getRecord("childhood").medals).toEqual(["ob_child_reader"]);

    const b = new WorldRecordsStore(fake as never);
    await b.init();
    expect(b.getRecord("childhood").medals).toEqual(["ob_child_reader"]);
  });
});
