import { describe, it, expect, beforeEach } from "vitest";
import { container } from "../../Container.js";
import NpcRegistry from "../../world/relationships/NpcRegistry.js";
import NpcSimulation from "../../world/relationships/NpcSimulation.js";
import RandomService from "../../core/random/RandomService.js";
import type {
  NpcRegion,
  NpcRegionView,
} from "../../world/regions/npcRegion.js";

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

/** A region view over one fixed region, for the coupling tests below. */
function view(prosperity: number, stability = 50): NpcRegionView {
  const here: NpcRegion = {
    id: "s_home",
    prosperity,
    stability,
    population: 50,
  };
  return {
    currentId: "s_home",
    of: (id) => (id === "s_home" || id === null || id === undefined ? here : undefined),
    bestNeighbor: () => undefined,
  };
}

describe("NpcSimulation and regions", () => {
  beforeEach(() => {
    reg({ id: "s_mom", roleKey: "npc.role.family", startAge: 40, kinOf: ["s_kid"] });
    reg({ id: "s_kid", roleKey: "npc.role.family", startAge: 10 });
    reg({ id: "s_friend", roleKey: "npc.role.friend", startAge: 28 });
    reg({ id: "s_boss", roleKey: "npc.role.work", startAge: 50 });
  });

  it("places the cast in the region they live in", () => {
    const s = sim();
    s.reset();
    expect(s.get("s_mom")?.homeRegion).toBeNull();

    container.resolve(RandomService).reseed(3);
    s.tickYear(undefined, view(50));

    expect(s.get("s_mom")?.homeRegion).toBe("s_home");
    expect(s.get("s_friend")?.homeRegion).toBe("s_home");
  });

  it("ignores a home region this world does not have", () => {
    const s = sim();
    s.restore({
      lives: {
        s_mom: {
          age: 40,
          stage: "adult",
          alive: true,
          health: 70,
          wealth: 50,
          mood: 50,
          careerTier: 1,
          partnerId: null,
          children: 0,
          moved: false,
          homeRegion: "not_a_region",
          goals: [],
          flags: [],
        } as never,
      },
    });
    container.resolve(RandomService).reseed(5);

    // The save can carry an id no world has; the year must survive it.
    expect(() => {
      for (let y = 0; y < 10; y++) s.tickYear(undefined, view(50));
    }).not.toThrow();
  });

  it("makes people in a thriving region richer than people in a ruined one", () => {
    const wealthAfter = (prosperity: number): number => {
      const s = sim();
      container.resolve(RandomService).reseed(11);
      s.reset();
      const v = view(prosperity);
      for (let y = 0; y < 20; y++) s.tickYear(undefined, v);
      return s.get("s_friend")?.wealth ?? 0;
    };

    expect(wealthAfter(95)).toBeGreaterThan(wealthAfter(5));
  });

  it("changes nothing at all when there is no region view", () => {
    // Reseed BEFORE reset: `reset` builds the cast from the random stream, so
    // seeding first is the only way the two runs start from the same people.
    const moodAfter = (withView: boolean): number => {
      const s = sim();
      container.resolve(RandomService).reseed(17);
      s.reset();
      for (let y = 0; y < 15; y++) {
        if (withView) s.tickYear(undefined, view(50));
        else s.tickYear();
      }
      return s.get("s_friend")?.mood ?? 0;
    };

    // A region doing merely okay must be indistinguishable from no region.
    expect(moodAfter(true)).toBe(moodAfter(false));
  });
});
