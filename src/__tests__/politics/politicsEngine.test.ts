import { describe, it, expect } from "vitest";
import {
  dominantFaction,
  emptyPolitics,
  marketBiasOf,
  meanRelation,
  publicOrder,
  relationKind,
  setLean,
  tickPolitics,
} from "../../world/politics/politicsEngine.js";

const fixed = (v: number) => () => v;

describe("setup", () => {
  it("seeds factions and rival relations from definitions", () => {
    const s = emptyPolitics([{ id: "a", rivals: ["b"] }, { id: "b" }]);
    expect(s.factions.a.relation.b).toBe(-55);
    expect(s.factions.b.relation.a).toBe(-55);
    expect(s.tension).toBe(30);
  });

  it("classifies relations", () => {
    expect(relationKind(40)).toBe("ally");
    expect(relationKind(0)).toBe("neutral");
    expect(relationKind(-40)).toBe("rival");
  });
});

describe("drift & flashpoints", () => {
  it("pushes tension up when factions hate each other, and erupts into conflict", () => {
    const s = emptyPolitics([{ id: "a", rivals: ["b"] }, { id: "b" }]);
    s.tension = 90; // already on the brink
    const events = tickPolitics(s, fixed(0));
    expect(s.tension).toBeGreaterThan(75);
    expect(events.some((e) => e.kind === "politics.conflict")).toBe(true);
  });

  it("enacts policies when there is room", () => {
    const s = emptyPolitics([{ id: "a" }, { id: "b" }]);
    const events = tickPolitics(s, fixed(0));
    expect(events.some((e) => e.kind === "politics.policyEnacted")).toBe(true);
    expect(s.policies.length).toBe(1);
  });

  it("caps active policies at three", () => {
    const s = emptyPolitics([{ id: "a" }, { id: "b" }]);
    for (let i = 0; i < 10; i++) tickPolitics(s, fixed(0));
    expect(s.policies.length).toBe(3);
  });
});

describe("aggregates", () => {
  it("picks the strongest faction", () => {
    const s = emptyPolitics([{ id: "a" }, { id: "b" }]);
    s.factions.b.power = 90;
    expect(dominantFaction(s)).toBe("b");
  });

  it("turns hostile relations into positive tension", () => {
    const s = emptyPolitics([{ id: "a", rivals: ["b"] }, { id: "b" }]);
    expect(meanRelation(s)).toBeLessThan(0);
  });

  it("derives a market tilt from active policies, clamped", () => {
    const s = emptyPolitics([{ id: "a" }, { id: "b" }]);
    s.policies = ["policy_austerity", "policy_crackdown"];
    const bias = marketBiasOf(s);
    expect(bias).toBeLessThan(0);
    expect(bias).toBeGreaterThanOrEqual(-0.15);
  });

  it("public order falls with tension", () => {
    const calm = emptyPolitics([{ id: "a" }, { id: "b" }]);
    calm.tension = 10;
    const tense = emptyPolitics([{ id: "a" }, { id: "b" }]);
    tense.tension = 90;
    expect(publicOrder(tense)).toBeLessThan(publicOrder(calm));
  });

  it("records the player's lean", () => {
    const s = emptyPolitics([{ id: "a" }, { id: "b" }]);
    setLean(s, "a");
    expect(s.playerLean).toBe("a");
    setLean(s, null);
    expect(s.playerLean).toBeNull();
  });
});
