import { describe, it, expect } from "vitest";
import {
  emptyWorkState,
  gainSkill,
  promotionGate,
  startVenture,
  tickVenture,
  tickWork,
  tryPromote,
  workAction,
  WorkStats,
} from "../../world/careers/careerEngine.js";

const stats: WorkStats = {
  intelligence: 50,
  social: 50,
  fitness: 50,
  health: 80,
  happiness: 60,
  age: 35,
};

const fixed = (v: number) => () => v;

describe("careerEngine basics", () => {
  it("starts with sane defaults", () => {
    const s = emptyWorkState();
    expect(s.performance).toBe(40);
    expect(s.burnout).toBe(0);
    expect(s.venture).toBeNull();
  });

  it("clamps skills to 0..10", () => {
    const s = emptyWorkState();
    gainSkill(s, "craft", 99);
    expect(s.skills.craft).toBe(10);
    gainSkill(s, "craft", -99);
    expect(s.skills.craft).toBe(0);
  });
});

describe("work actions", () => {
  it("overtime trades burnout for performance; rest recovers", () => {
    const s = emptyWorkState();
    workAction(s, "work_overtime");
    expect(s.performance).toBeGreaterThan(40);
    expect(s.burnout).toBeGreaterThan(0);
    const b = s.burnout;
    workAction(s, "work_rest");
    expect(s.burnout).toBeLessThan(b);
  });

  it("only certifies once the craft is high enough", () => {
    const s = emptyWorkState();
    expect(workAction(s, "work_certify")[0].kind).toBe("work.certFail");
    workAction(s, "work_learn");
    workAction(s, "work_learn");
    expect(s.skills.craft).toBe(4);
    expect(workAction(s, "work_certify")[0].kind).toBe("work.certified");
    // second attempt is a no-op failure (already held)
    expect(workAction(s, "work_certify")[0].kind).toBe("work.certFail");
  });
});

describe("yearly work tick", () => {
  it("raises performance when skilled and calm", () => {
    const s = emptyWorkState();
    gainSkill(s, "craft", 5);
    gainSkill(s, "lead", 5);
    tickWork(s, stats, fixed(0.5));
    expect(s.performance).toBeGreaterThan(40);
    expect(s.tenure).toBe(1);
  });

  it("sinks performance when burned out, and warns", () => {
    const s = emptyWorkState();
    s.burnout = 90;
    tickWork(s, stats, fixed(0.5));
    expect(s.performance).toBeLessThan(40);
  });

  it("flags severe burnout", () => {
    const s = emptyWorkState();
    s.burnout = 95;
    const events = tickWork(s, stats, fixed(0.5));
    expect(events.some((e) => e.kind === "work.burnout")).toBe(true);
  });
});

describe("promotion gates", () => {
  it("requires performance and leadership that rise with rank", () => {
    expect(promotionGate(1).performance).toBeGreaterThan(promotionGate(0).performance);
    expect(promotionGate(1).skill).toBeGreaterThan(promotionGate(0).skill);
  });

  it("promotes only when the gate and the role requirements are met", () => {
    const s = emptyWorkState();
    s.performance = 90;
    gainSkill(s, "lead", 6);
    gainSkill(s, "craft", 6);
    expect(tryPromote(s, 3, false)).toBe(false);
    expect(tryPromote(s, 3, true)).toBe(true);
    expect(s.rank).toBe(1);
    expect(s.tenure).toBe(0);
  });

  it("does not promote past the top rank", () => {
    const s = emptyWorkState();
    s.rank = 2;
    s.performance = 100;
    gainSkill(s, "lead", 10);
    gainSkill(s, "craft", 10);
    expect(tryPromote(s, 3, true)).toBe(false);
  });
});

describe("venture", () => {
  it("refuses to start without capital", () => {
    const s = emptyWorkState();
    expect(startVenture(s, "tech", 50)[0].kind).toBe("venture.tooPoor");
    expect(s.venture).toBeNull();
  });

  it("runs a profitable year and grows the product", () => {
    const s = emptyWorkState();
    startVenture(s, "tech", 1000);
    const before = s.venture!.capital;
    const t = tickVenture(s.venture!, fixed(0.99));
    expect(t.bankrupt).toBe(false);
    expect(t.revenue).toBeGreaterThan(0);
    expect(s.venture!.product).toBeGreaterThan(30);
    expect(s.venture!.capital).toBeGreaterThan(before);
  });

  it("goes bankrupt when the wage bill outruns the capital", () => {
    const s = emptyWorkState();
    s.venture = { industry: "trade", capital: 1, staff: 10, product: 10, revenue: 0, risk: 0 };
    const t = tickVenture(s.venture, fixed(0.99));
    expect(t.bankrupt).toBe(true);
    expect(t.events.some((e) => e.kind === "venture.bankrupt")).toBe(true);
  });

  it("takes trouble when risk rolls badly", () => {
    const s = emptyWorkState();
    startVenture(s, "food", 1000);
    s.venture!.capital = 100;
    s.venture!.product = 10; // weak product, so trouble outweighs revenue
    const cap = s.venture!.capital;
    const t = tickVenture(s.venture!, fixed(0)); // always triggers trouble
    expect(t.events.some((e) => e.kind === "venture.trouble")).toBe(true);
    expect(s.venture!.capital).toBeLessThan(cap);
  });
});
