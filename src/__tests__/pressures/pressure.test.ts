import { describe, it, expect, beforeEach } from "vitest";
import { container } from "../../Container.js";
import PressureRegistry from "../../world/pressures/PressureRegistry.js";
import PressureLoader from "../../world/pressures/PressureLoader.js";
import PressureState from "../../world/pressures/PressureState.js";
import PressureFilter, {
  meetsPressureGate,
  pressureBiasFactor,
} from "../../world/pressures/PressureFilter.js";
import FilterContext from "../../event/FilterContext.js";
import { Incident } from "../../world/Incident.js";

beforeEach(() => {
  container.resolve(PressureLoader).loadBuiltin();
});

describe("hidden-score web", () => {
  it("loads 30+ axes across classes plus coupling rules", () => {
    const reg = container.resolve(PressureRegistry);
    expect(reg.getAxes().length).toBeGreaterThanOrEqual(30);
    expect(reg.getRules().length).toBeGreaterThanOrEqual(40);
    const classes = new Set(reg.getAxes().map((a) => a.class));
    expect(classes.size).toBeGreaterThanOrEqual(5);
  });

  it("all rules reference real axes (after pruning)", () => {
    const reg = container.resolve(PressureRegistry);
    for (const r of reg.getRules()) {
      expect(reg.hasAxis(r.source)).toBe(true);
      expect(reg.hasAxis(r.target)).toBe(true);
    }
  });

  it("resets every axis to its initial value", () => {
    const p = new PressureState();
    expect(p.get("pr_order")).toBe(50);
    expect(p.get("pr_unrest")).toBe(50);
  });

  it("couples: high unrest lowers order and raises crime", () => {
    const p = new PressureState();
    p.set("pr_unrest", 80);
    p.tick(() => 0.5, 0); // deterministic, no jitter
    expect(p.get("pr_order")).toBeLessThan(50);
    expect(p.get("pr_crime")).toBeGreaterThan(50);
  });

  it("drifts an axis back toward its baseline", () => {
    const p = new PressureState();
    p.set("pr_hope", 90);
    p.tick(() => 0.5, 0);
    expect(p.get("pr_hope")).toBeLessThan(90);
  });

  it("clamps to the axis range", () => {
    const p = new PressureState();
    p.set("pr_order", 9999);
    expect(p.get("pr_order")).toBe(100);
    p.set("pr_order", -50);
    expect(p.get("pr_order")).toBe(0);
  });

  it("keeps everything in range after a year", () => {
    const p = new PressureState();
    for (let i = 0; i < 50; i++) p.tick(() => Math.random(), 1);
    for (const ax of container.resolve(PressureRegistry).getAxes()) {
      const v = p.get(ax.id);
      expect(v).toBeGreaterThanOrEqual(ax.min);
      expect(v).toBeLessThanOrEqual(ax.max);
    }
  });

  it("round-trips through a snapshot", () => {
    const p = new PressureState();
    p.set("pr_plague", 72);
    p.tick(() => 0.5, 0);
    const snap = p.snapshot();
    const p2 = new PressureState();
    p2.restore(snap);
    expect(p2.snapshot()).toEqual(snap);
  });

  it("experiences a feedback loop over time (unrest ↔ crime)", () => {
    const p = new PressureState();
    p.set("pr_unrest", 90);
    const beforeOrder = p.get("pr_order");
    for (let i = 0; i < 10; i++) {
      p.tick(() => 0.5, 0);
      p.set("pr_unrest", 90); // hold the driver steady
    }
    expect(p.get("pr_order")).toBeLessThan(beforeOrder);
    expect(p.get("pr_crime")).toBeGreaterThan(50);
  });
});

describe("pressure gate + bias", () => {
  function ctx(incident: Incident, p: PressureState): FilterContext {
    return {
      incident,
      rangeKey: "0-100",
      triggeredHistory: new Set(),
      blockedHistory: new Set(),
      rangeHistory: new Map(),
      pressures: p,
    };
  }
  const mk = (extra: Record<string, unknown>) =>
    extra as unknown as Incident;

  it("meetsPressureGate checks the band", () => {
    const p = new PressureState();
    p.set("pr_plague", 80);
    expect(meetsPressureGate({ axis: "pr_plague", gte: 70 }, p)).toBe(true);
    expect(meetsPressureGate({ axis: "pr_plague", lte: 60 }, p)).toBe(false);
  });

  it("PressureFilter drops events whose gate is unmet", () => {
    const p = new PressureState();
    p.set("pr_plague", 80);
    const f = new PressureFilter();
    expect(
      f.isEligible(ctx(mk({ pressureGate: { axis: "pr_plague", gte: 70 } }), p)),
    ).toBe(true);
    expect(
      f.isEligible(ctx(mk({ pressureGate: { axis: "pr_plague", lte: 60 } }), p)),
    ).toBe(false);
    expect(f.isEligible(ctx(mk({ pressureGate: null }), p))).toBe(true);
  });

  it("bias multiplies weight only when the band holds", () => {
    const p = new PressureState();
    p.set("pr_tension", 90);
    expect(
      pressureBiasFactor([{ axis: "pr_tension", factor: 3, gte: 70 }], p),
    ).toBe(3);
    expect(
      pressureBiasFactor([{ axis: "pr_tension", factor: 3, lte: 50 }], p),
    ).toBe(1);
  });
});
