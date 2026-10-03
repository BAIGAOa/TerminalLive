import { describe, it, expect, beforeEach } from "vitest";
import { container } from "../../Container.js";
import World from "../../content/World.js";
import WorldRegistry from "../../world/chronicle/WorldRegistry.js";
import WorldState from "../../world/chronicle/WorldState.js";
import WorldFilter, {
  meetsWorldGate,
} from "../../world/chronicle/WorldFilter.js";
import { eraForYear } from "../../world/chronicle/eras.js";
import { meetsUnlock, UnlockCondition } from "../../world/chronicle/unlock.js";
import { evaluateFates, fateWeightFactor } from "../../world/chronicle/fate.js";
import FilterContext from "../../event/FilterContext.js";
import { Incident } from "../../world/Incident.js";

beforeEach(() => World.load());

function freshWorld(regionId = "reg_highland"): WorldState {
  const w = new WorldState();
  w.begin(regionId);
  return w;
}

describe("chronicle — eras", () => {
  it("maps a year to the latest era that has begun", () => {
    const eras = container.resolve(WorldRegistry).getEras();
    expect(eraForYear(eras, 0)?.id).toBe("era_dawn");
    expect(eraForYear(eras, 19)?.id).toBe("era_dawn");
    expect(eraForYear(eras, 20)?.id).toBe("era_iron");
    expect(eraForYear(eras, 100)?.id).toBe("era_star");
  });
});

describe("chronicle — unlock conditions", () => {
  const ctx = {
    year: 50,
    eraId: "era_steam",
    karma: { benevolence: 20, ambition: 0, wisdom: 45, rebellion: 0 },
    standing: new Map([["fac_scholars", 35]]),
    flags: new Set(["traveled"]),
  };

  it("era / year / karma / faction / flag", () => {
    expect(meetsUnlock({ kind: "era", era: "era_steam" }, ctx)).toBe(true);
    expect(meetsUnlock({ kind: "era", era: "era_iron" }, ctx)).toBe(false);
    expect(meetsUnlock({ kind: "year", year: 50 }, ctx)).toBe(true);
    expect(meetsUnlock({ kind: "year", year: 60 }, ctx)).toBe(false);
    expect(meetsUnlock({ kind: "karma", axis: "wisdom", gte: 40 }, ctx)).toBe(true);
    expect(meetsUnlock({ kind: "karma", axis: "rebellion", gte: 40 }, ctx)).toBe(false);
    expect(meetsUnlock({ kind: "faction", faction: "fac_scholars", min: 30 }, ctx)).toBe(true);
    expect(meetsUnlock({ kind: "flag", flag: "traveled" }, ctx)).toBe(true);
  });

  it("all / any nest", () => {
    const cond: UnlockCondition = {
      kind: "all",
      of: [
        { kind: "era", era: "era_steam" },
        {
          kind: "any",
          of: [
            { kind: "karma", axis: "wisdom", gte: 40 },
            { kind: "flag", flag: "nope" },
          ],
        },
      ],
    };
    expect(meetsUnlock(cond, ctx)).toBe(true);
  });
});

describe("chronicle — fate arcs", () => {
  it("evaluates which arcs are active and biases weights", () => {
    const defs = container.resolve(WorldRegistry).getFates();
    const ctx = {
      year: 30,
      eraId: "era_iron",
      karma: { benevolence: 0, ambition: 0, wisdom: 50, rebellion: 0 },
      standing: new Map<string, number>(),
      flags: new Set<string>(),
    };
    const active = new Set(evaluateFates(defs, ctx));
    expect(active.has("fate_sage")).toBe(true);
    expect(active.has("fate_tycoon")).toBe(false);

    // sage favours the maths olympiad
    expect(fateWeightFactor(defs, active, "ev_math_olympiad")).toBe(2);
    expect(fateWeightFactor(defs, active, "ev_invest")).toBe(1);
  });
});

describe("chronicle — WorldState", () => {
  it("begin() sets region + starting karma + era", () => {
    const w = freshWorld("reg_highland");
    expect(w.regionId).toBe("reg_highland");
    expect(w.eraId).toBe("era_dawn");
    expect(w.karma.wisdom).toBe(5); // region tone
    expect(w.standing.get("fac_scholars")).toBe(10); // favourFaction
  });

  it("tick() advances era and unlocks lore/fates", () => {
    const w = freshWorld();
    const r1 = w.tick(25, new Set());
    expect(r1.eraChanged).toBe("era_iron");
    // wisdom karma rises with an action, then wisdom-gated lore unlocks
    w.applyKarma({ wisdom: 45 });
    expect([...w.unlockedLore]).toContain("lore_wise_one");
    expect([...w.activeFates]).toContain("fate_sage");
  });

  it("fires scripted world events when their year arrives, once", () => {
    const w = freshWorld();
    const r = w.tick(6, new Set());
    expect(r.worldEvents).toContain("we_hard_winter");
    const r2 = w.tick(7, new Set());
    expect(r2.worldEvents).not.toContain("we_hard_winter");
  });

  it("rivalry: helping one faction sours its rival", () => {
    const w = freshWorld("reg_harbor"); // seeds fac_wardens +10
    const before = w.standing.get("fac_shadows") ?? 0;
    w.adjustStanding("fac_wardens", 20);
    expect(w.standing.get("fac_shadows")!).toBeLessThan(before);
  });

  it("round-trips through a snapshot", () => {
    const w = freshWorld("reg_harbor");
    w.tick(30, new Set(["married"]));
    w.applyKarma({ benevolence: 30 });
    w.adjustStanding("fac_wardens", 15);
    const snap = w.toSnapshot();
    expect(snap.firedWorldEvents).toContain("we_hard_winter"); // year 6 passed

    const w2 = new WorldState();
    w2.restore(snap, new Set(["married"]));
    expect(w2.year).toBe(30);
    expect(w2.regionId).toBe("reg_harbor");
    expect(w2.karma.benevolence).toBe(35); // region +5, applied +30
    expect(w2.standing.get("fac_wardens")).toBe(25); // 10 seed + 15
    expect(w2.unlockedLore.has("lore_kind_heart")).toBe(true);
    expect(w2.toSnapshot()).toEqual(snap);
  });

  it("fateWeight reflects active arcs", () => {
    const w = freshWorld();
    w.applyKarma({ wisdom: 50 });
    expect(w.activeFates.has("fate_sage")).toBe(true);
    expect(w.fateWeight("ev_math_olympiad")).toBe(2);
  });
});

describe("chronicle — WorldFilter", () => {
  function ctxWith(incident: Incident, world: WorldState | null): FilterContext {
    return {
      incident,
      rangeKey: "0-100",
      triggeredHistory: new Set(),
      blockedHistory: new Set(),
      rangeHistory: new Map(),
      world,
    };
  }
  const mkIncident = (gate: unknown) =>
    ({ worldGate: gate } as unknown as Incident);

  it("passes ungated events", () => {
    const f = new WorldFilter();
    expect(f.isEligible(ctxWith(mkIncident(null), freshWorld()))).toBe(true);
  });

  it("gates on era / faction standing", () => {
    const w = freshWorld(); // era_dawn, no shadows standing
    const f = new WorldFilter();
    expect(
      f.isEligible(ctxWith(mkIncident({ era: "era_iron" }), w)),
    ).toBe(false);
    expect(
      f.isEligible(ctxWith(mkIncident({ era: "era_dawn" }), w)),
    ).toBe(true);
    w.adjustStanding("fac_shadows", 40);
    expect(
      f.isEligible(
        ctxWith(mkIncident({ faction: "fac_shadows", minStanding: 30 }), w),
      ),
    ).toBe(true);
    expect(
      f.isEligible(
        ctxWith(mkIncident({ faction: "fac_scholars", minStanding: 30 }), w),
      ),
    ).toBe(false);
  });

  it("meetsWorldGate checks region", () => {
    const w = freshWorld("reg_wastes");
    expect(meetsWorldGate({ region: "reg_wastes" }, w)).toBe(true);
    expect(meetsWorldGate({ region: "reg_harbor" }, w)).toBe(false);
  });
});
