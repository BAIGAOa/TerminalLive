import { describe, it, expect } from "vitest";
import Player from "../../world/Player.js";
import LineageStore from "../../core/store/LineageStore.js";
import {
  buildLineageRecord,
  computeInheritance,
} from "../../world/lineage/inheritance.js";
import { alignmentKey } from "../../world/chronicle/karma.js";
import {
  LINEAGE_HISTORY_CAP,
  LineageRecord,
} from "../../types/LineageType.js";

function makeRecord(
  generation: number,
  stats: Partial<LineageRecord["stats"]> = {},
  karma: Record<string, number> = {},
): LineageRecord {
  return {
    generation,
    name: `Gen${generation}`,
    age: 80,
    reason: "death",
    score: 200,
    rankKey: "rank.b",
    achievements: 0,
    endedAt: "2026-10-04T00:00:00.000Z",
    epithetKey: "karma.neutral",
    karma,
    stats: {
      intelligence: 10,
      social: 10,
      fitness: 10,
      happiness: 60,
      reputation: 0,
      health: 100,
      money: 0,
      ...stats,
    },
  };
}

/** In-memory stand-in for JSONparsing (avoids touching resource/). */
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

describe("computeInheritance", () => {
  it("is a no-op without an ancestor", () => {
    expect(computeInheritance(null)).toBeNull();
  });

  it("passes a quarter of the estate, capped at 2000", () => {
    expect(computeInheritance(makeRecord(1, { money: 400 }))?.money).toBe(100);
    expect(computeInheritance(makeRecord(1, { money: 10000 }))?.money).toBe(2000);
  });

  it("grants aptitude only above 40, capped at +5", () => {
    const at = (v: number) =>
      computeInheritance(makeRecord(1, { intelligence: v }))?.deltas
        .intelligence ?? 0;
    expect(at(30)).toBe(0);
    expect(at(40)).toBe(0);
    expect(at(50)).toBe(1);
    expect(at(95)).toBe(5);
    expect(at(200)).toBe(5);
  });

  it("passes reputation at 10%, capped at 10", () => {
    expect(
      computeInheritance(makeRecord(1, { reputation: 250 }))?.deltas.reputation,
    ).toBe(10);
    expect(
      computeInheritance(makeRecord(1, { reputation: 0 }))?.deltas.reputation,
    ).toBeUndefined();
  });

  it("leans karma toward the ancestor's dominant axis", () => {
    const pos = computeInheritance(
      makeRecord(1, {}, { benevolence: 0, ambition: 0, wisdom: 80, rebellion: 0 }),
    );
    expect(pos?.karmaLean).toEqual({ wisdom: 8 });

    const neg = computeInheritance(
      makeRecord(1, {}, { benevolence: 0, ambition: -50, wisdom: 0, rebellion: 0 }),
    );
    expect(neg?.karmaLean).toEqual({ ambition: -5 });

    const none = computeInheritance(makeRecord(1, {}, {}));
    expect(none?.karmaLean).toBeNull();
  });

  it("advances the generation and keeps the epithet", () => {
    const plan = computeInheritance(makeRecord(3, {}, { wisdom: 80 }));
    expect(plan?.generation).toBe(4);
    expect(plan?.flag).toBe("lineage_heir");
  });
});

describe("buildLineageRecord", () => {
  it("captures stats, score/rank and the karma epithet", () => {
    const player = new Player({
      playerName: "Ancestor",
      age: 90,
      health: 80,
      money: 500,
      intelligence: 60,
      social: 20,
      fitness: 30,
    });
    const karma = { benevolence: 0, ambition: 0, wisdom: 70, rebellion: 0 };
    const record = buildLineageRecord({
      player,
      karma,
      reason: "death",
      achievements: 2,
      generation: 2,
    });
    expect(record.generation).toBe(2);
    expect(record.name).toBe("Ancestor");
    expect(record.stats.money).toBe(500);
    expect(record.stats.intelligence).toBe(60);
    expect(record.epithetKey).toBe(alignmentKey(karma));
    expect(record.epithetKey).toBe("karma.wisdom.pos");
    expect(record.reason).toBe("death");
  });
});

describe("alignmentKey", () => {
  it("falls back to neutral on empty karma", () => {
    expect(alignmentKey({ benevolence: 0, ambition: 0, wisdom: 0, rebellion: 0 })).toBe(
      "karma.neutral",
    );
  });
});

describe("inheritance clamping", () => {
  it("never pushes a gauge past 100", () => {
    const player = new Player({ playerName: "Heir", age: 0, intelligence: 98 });
    const plan = computeInheritance(makeRecord(1, { intelligence: 95 }));
    player.applyDelta({ money: plan!.money, ...plan!.deltas });
    expect(player.intelligence).toBe(100);
    expect(player.money).toBeGreaterThanOrEqual(0);
  });
});

describe("LineageStore", () => {
  it("defaults when the file is missing", async () => {
    const store = new LineageStore(new FakePersistence() as never);
    await store.init();
    expect(store.getLast()).toBeNull();
    expect(store.getNextGeneration()).toBe(1);
  });

  it("persists across instances and derives the next generation", async () => {
    const fake = new FakePersistence();
    const a = new LineageStore(fake as never);
    await a.init();
    await a.recordLife(makeRecord(1));
    expect(a.getNextGeneration()).toBe(2);

    const b = new LineageStore(fake as never);
    await b.init();
    expect(b.getLast()?.generation).toBe(1);
    expect(b.getNextGeneration()).toBe(2);
  });

  it("replaces a duplicate generation instead of appending", async () => {
    const store = new LineageStore(new FakePersistence() as never);
    await store.init();
    await store.recordLife(makeRecord(1, { money: 100 }));
    await store.recordLife(makeRecord(1, { money: 999 }));
    expect(store.getHistory()).toHaveLength(1);
    expect(store.getLast()?.stats.money).toBe(999);
  });

  it("caps the family line", async () => {
    const store = new LineageStore(new FakePersistence() as never);
    await store.init();
    for (let g = 1; g <= LINEAGE_HISTORY_CAP + 3; g++) {
      await store.recordLife(makeRecord(g));
    }
    expect(store.getHistory()).toHaveLength(LINEAGE_HISTORY_CAP);
    expect(store.getLast()?.generation).toBe(LINEAGE_HISTORY_CAP + 3);
  });
});
