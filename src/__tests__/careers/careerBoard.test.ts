import { describe, it, expect } from "vitest";
import {
  buildCareerBoard,
  entryMet,
  gateStatus,
  rankViews,
  summarizeBoard,
} from "../../world/careers/careerBoard.js";
import type Player from "../../world/Player.js";
import {
  DEFAULT_TERMS,
  type CareerDefinition,
} from "../../world/careers/CareerDefinition.js";
import { emptyWorkState } from "../../world/careers/careerEngine.js";

function fakePlayer(
  stats: Record<string, number>,
  opts: { careerId?: string | null; rels?: Record<string, number> } = {},
): Player {
  return {
    careerId: opts.careerId ?? null,
    careerRank: 0,
    getStat: (k: string) => stats[k] ?? 0,
    getRelationship: (id: string) => opts.rels?.[id] ?? 0,
  } as unknown as Player;
}

function career(
  id: string,
  entry: CareerDefinition["entry"] = [],
  over: Partial<CareerDefinition> = {},
): CareerDefinition {
  return {
    id,
    labelKey: `${id}.label`,
    descKey: `${id}.desc`,
    icon: "💼",
    fieldKey: "career.field.misc",
    entry,
    lifelong: false,
    mechanics: [],
    terms: DEFAULT_TERMS,
    ranks: [{ titleKey: `${id}.r0`, salary: 10, requires: [] }],
    ...over,
  };
}

describe("gateStatus", () => {
  it("resolves a lower bound against the player", () => {
    expect(gateStatus(fakePlayer({ age: 20 }), { prop: "age", gte: 18 })).toMatchObject({
      key: "age",
      value: 20,
      gte: 18,
      met: true,
    });
    expect(gateStatus(fakePlayer({ age: 16 }), { prop: "age", gte: 18 }).met).toBe(false);
  });

  it("resolves an upper bound, so a job can close behind you", () => {
    const gate = gateStatus(fakePlayer({ age: 40 }), { prop: "age", lte: 30 });
    expect(gate.met).toBe(false);
    expect(gate.value).toBe(40);
  });

  it("gates on an NPC relationship when asked", () => {
    const gate = gateStatus(fakePlayer({}, { rels: { boss: 80 } }), {
      npc: "boss",
      gte: 70,
    });
    expect(gate).toMatchObject({ key: "boss", isNpc: true, value: 80, met: true });
  });

  it("fails closed on a targetless requirement", () => {
    expect(gateStatus(fakePlayer({}), {}).met).toBe(false);
  });
});

describe("entryMet", () => {
  it("requires every gate", () => {
    const job = career("a", [
      { prop: "age", gte: 18 },
      { prop: "appearance", gte: 75 },
    ]);
    expect(entryMet(fakePlayer({ age: 30, appearance: 80 }), job)).toBe(true);
    expect(entryMet(fakePlayer({ age: 30, appearance: 50 }), job)).toBe(false);
  });

  it("treats an ungated job as open to anyone", () => {
    expect(entryMet(fakePlayer({}), career("a"))).toBe(true);
  });
});

describe("buildCareerBoard", () => {
  const open = career("open");
  const gated = career("gated", [{ prop: "appearance", gte: 75 }]);
  const sworn = career("sworn", [], { lifelong: true });

  it("marks reachable, locked and otherwise-open jobs", () => {
    const cards = buildCareerBoard(fakePlayer({ appearance: 40 }), [open, gated]);
    expect(cards.map((c) => c.state)).toEqual(["available", "locked"]);
    expect(cards[1].unmet).toHaveLength(1);
    expect(cards[1].unmet[0].key).toBe("appearance");
  });

  it("marks the job the player already holds", () => {
    const cards = buildCareerBoard(fakePlayer({}, { careerId: "open" }), [open, gated]);
    expect(cards[0].state).toBe("current");
  });

  it("seals off every other job while a life-long post is held", () => {
    const cards = buildCareerBoard(fakePlayer({ appearance: 90 }, { careerId: "sworn" }), [
      open,
      gated,
      sworn,
    ]);
    expect(cards.map((c) => c.state)).toEqual(["sealed", "sealed", "current"]);
  });

  it("does not seal anything for an ordinary employee", () => {
    const cards = buildCareerBoard(fakePlayer({ appearance: 90 }, { careerId: "open" }), [
      open,
      gated,
    ]);
    expect(cards.map((c) => c.state)).toEqual(["current", "available"]);
  });

  it("carries the salary span and the ladder length onto the card", () => {
    const job = career("climber", [], {
      ranks: [
        { titleKey: "r0", salary: 30, requires: [] },
        { titleKey: "r1", salary: 90, requires: [] },
        { titleKey: "r2", salary: 200, requires: [] },
      ],
    });
    const [card] = buildCareerBoard(fakePlayer({}), [job]);
    expect(card.entrySalary).toBe(30);
    expect(card.topSalary).toBe(200);
    expect(card.ranks).toBe(3);
  });
});

describe("summarizeBoard", () => {
  it("counts what a player can and cannot take", () => {
    const cards = buildCareerBoard(fakePlayer({ appearance: 90 }), [
      career("a"),
      career("b", [{ prop: "appearance", gte: 95 }]),
    ]);
    expect(summarizeBoard(cards)).toEqual({
      total: 2,
      available: 1,
      locked: 1,
      sealed: 0,
      cooling: 0,
    });
  });
});

describe("cooldowns on the board", () => {
  const job = career("cooler");

  it("marks a job the player is qualified for but still barred from", () => {
    const work = emptyWorkState();
    work.cooldowns[job.id] = 40; // open again at 40
    const [card] = buildCareerBoard(fakePlayer({}), [job], work, 32);
    expect(card.state).toBe("cooling");
    expect(card.cooldownYears).toBe(8);
  });

  it("lets the card go back to available once the wait is over", () => {
    const work = emptyWorkState();
    work.cooldowns[job.id] = 40;
    const [card] = buildCareerBoard(fakePlayer({}), [job], work, 40);
    expect(card.state).toBe("available");
    expect(card.cooldownYears).toBe(0);
  });

  it("never hides a gate failure behind a cooldown", () => {
    const gated = career("gated", [{ prop: "appearance", gte: 90 }]);
    const work = emptyWorkState();
    work.cooldowns[gated.id] = 40;
    const [card] = buildCareerBoard(fakePlayer({ appearance: 10 }), [gated], work, 30);
    expect(card.state).toBe("locked");
  });
});

describe("rankViews", () => {
  it("resolves each rung's promotion gates", () => {
    const job = career("a", [], {
      ranks: [
        { titleKey: "r0", salary: 10, requires: [] },
        { titleKey: "r1", salary: 20, requires: [{ prop: "intelligence", gte: 50 }] },
      ],
    });
    const views = rankViews(fakePlayer({ intelligence: 30 }), job);
    expect(views[0]).toMatchObject({ gateCount: 0, met: true });
    expect(views[1]).toMatchObject({ gateCount: 1, metCount: 0, met: false });
  });
});

