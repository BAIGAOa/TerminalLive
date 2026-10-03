import { describe, it, expect } from "vitest";
import {
  applyKarma,
  alignmentKey,
  dominantAxis,
  emptyKarma,
  karmaScore,
  KARMA_MAX,
  KARMA_MIN,
} from "../../world/chronicle/karma.js";

describe("karma", () => {
  it("starts empty", () => {
    expect(emptyKarma()).toEqual({
      benevolence: 0,
      ambition: 0,
      wisdom: 0,
      rebellion: 0,
    });
  });

  it("adds deltas", () => {
    const s = applyKarma(emptyKarma(), { wisdom: 10, ambition: 5 });
    expect(s.wisdom).toBe(10);
    expect(s.ambition).toBe(5);
  });

  it("clamps to the axis range", () => {
    const hi = applyKarma(emptyKarma(), { benevolence: 9999 });
    expect(hi.benevolence).toBe(KARMA_MAX);
    const lo = applyKarma(emptyKarma(), { rebellion: -9999 });
    expect(lo.rebellion).toBe(KARMA_MIN);
  });

  it("finds the dominant axis by absolute value", () => {
    const s = applyKarma(emptyKarma(), { wisdom: 30, rebellion: -50 });
    expect(dominantAxis(s)).toEqual({ axis: "rebellion", value: -50 });
  });

  it("derives a signed alignment key", () => {
    expect(alignmentKey(emptyKarma())).toBe("karma.neutral");
    expect(alignmentKey(applyKarma(emptyKarma(), { wisdom: 20 }))).toBe(
      "karma.wisdom.pos",
    );
    expect(alignmentKey(applyKarma(emptyKarma(), { benevolence: -20 }))).toBe(
      "karma.benevolence.neg",
    );
  });

  it("sums the axes for a score", () => {
    const s = applyKarma(emptyKarma(), { wisdom: 10, ambition: 5, rebellion: -3 });
    expect(karmaScore(s)).toBe(12);
  });
});
