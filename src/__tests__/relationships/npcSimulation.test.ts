import { describe, it, expect, beforeEach } from "vitest";
import { container } from "../../Container.js";
import NpcRegistry from "../../world/relationships/NpcRegistry.js";
import NpcSimulation from "../../world/relationships/NpcSimulation.js";
import RandomService from "../../core/random/RandomService.js";

function reg(def: {
  id: string;
  roleKey?: string;
  startAge?: number;
  kinOf?: string[];
}) {
  const r = container.resolve(NpcRegistry);
  if (!r.has(def.id)) {
    r.register({ labelKey: def.id, descKey: def.id, ...def });
  }
}

function sim(): NpcSimulation {
  return container.resolve(NpcSimulation);
}

describe("NpcSimulation", () => {
  beforeEach(() => {
    reg({ id: "s_mom", roleKey: "npc.role.family", startAge: 40, kinOf: ["s_kid"] });
    reg({ id: "s_kid", roleKey: "npc.role.family", startAge: 10 });
    reg({ id: "s_friend", roleKey: "npc.role.friend", startAge: 28 });
    reg({ id: "s_boss", roleKey: "npc.role.work", startAge: 50 });
  });

  it("seeds lives, personality traits and a social graph", () => {
    const s = sim();
    s.reset();
    expect(s.get("s_mom")?.age).toBe(40);
    expect(s.get("s_kid")?.stage).toBe("child");
    expect(s.getTraits("s_friend").sociability).toBeGreaterThan(0.5);
    // kin edge from the definition + same-role kin seeding
    expect(s.edge("s_mom", "s_kid")?.kind).toBe("kin");
    expect(s.neighbors("s_mom").length).toBeGreaterThan(0);
  });

  it("ages everyone and returns life events", () => {
    const s = sim();
    s.reset();
    const before = s.get("s_kid")!.age;
    const events = s.tickYear();
    expect(s.get("s_kid")!.age).toBe(before + 1);
    expect(Array.isArray(events)).toBe(true);
  });

  it("mortality follows age and frailty (a dying elder passes away)", () => {
    const s = sim();
    s.reset();
    container.resolve(RandomService).reseed(7);
    // Force a very frail elder.
    s.restore({
      lives: {
        s_boss: {
          age: 95,
          stage: "elder",
          alive: true,
          health: 1,
          wealth: 40,
          mood: 40,
          careerTier: 3,
          partnerId: null,
          children: 0,
          moved: false,
          homeRegion: null,
          goals: ["career"],
        },
      },
    });
    let died = false;
    for (let i = 0; i < 60 && !died; i++) {
      if (s.tickYear().some((e) => e.npcId === "s_boss" && e.kind === "died")) {
        died = true;
      }
    }
    expect(died).toBe(true);
    expect(s.get("s_boss")?.alive).toBe(false);
    expect(s.statusKey("s_boss")).toBe("npc.status.deceased");
  });

  it("moved and deceased NPCs are unavailable", () => {
    const s = sim();
    s.reset();
    s.restore({
      lives: {
        s_friend: {
          age: 30,
          stage: "adult",
          alive: true,
          health: 70,
          wealth: 40,
          mood: 60,
          careerTier: 1,
          partnerId: null,
          children: 0,
          moved: true,
          homeRegion: "r",
          goals: [],
        },
      },
    });
    expect(s.isAvailable("s_friend")).toBe(false);
    expect(s.statusKey("s_friend")).toBe("npc.status.moved");
  });

  it("clamps multi-axis bonds", () => {
    const s = sim();
    s.reset();
    s.adjustBond("s_mom", { trust: 999, conflict: -50, debt: 500 });
    const b = s.bond("s_mom");
    expect(b.trust).toBe(100);
    expect(b.conflict).toBe(0);
    expect(b.debt).toBe(100);
  });

  it("round-trips lives, edges and bonds through a snapshot", () => {
    const s = sim();
    s.reset();
    s.adjustBond("s_friend", { trust: 48 }); // 40 → 88
    const snap = s.snapshot();
    s.reset();
    expect(s.bond("s_friend").trust).toBe(40);
    s.restore(snap);
    expect(s.bond("s_friend").trust).toBe(88);
    expect(s.get("s_mom")?.age).toBe(40);
    expect(Object.keys(snap.edges).length).toBeGreaterThan(0);
  });
});
