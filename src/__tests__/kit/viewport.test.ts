import { describe, it, expect } from "vitest";
import {
  bar,
  barWidthFor,
  clampHeight,
  clampWidth,
  statusViewHeight,
} from "../../ui/kit/viewport.js";

describe("bar", () => {
  it("fills proportionally to value / max", () => {
    expect(bar(50, 10)).toBe("█████░░░░░");
    expect(bar(0, 10)).toBe("░░░░░░░░░░");
    expect(bar(100, 10)).toBe("██████████");
  });

  it("rounds to the nearest cell", () => {
    expect(bar(55, 10)).toBe("██████░░░░"); // round(5.5) = 6
  });

  it("clamps out-of-range values instead of overflowing", () => {
    expect(bar(150, 10)).toBe("██████████");
    expect(bar(-20, 10)).toBe("░░░░░░░░░░");
  });

  it("honors a custom max and the default width", () => {
    expect(bar(50, 10, 200)).toBe("███░░░░░░░"); // 50/200 = 0.25 → 2.5 → 3
    expect(bar(100)).toHaveLength(18);
  });
});

describe("barWidthFor", () => {
  it("scales ~22% of the terminal, clamped to 8–20", () => {
    expect(barWidthFor(40)).toBe(8); // floor(8.8) = 8
    expect(barWidthFor(20)).toBe(8); // floor(4.4) → clamped up
    expect(barWidthFor(100)).toBe(20); // floor(22) → clamped down
    expect(barWidthFor(91)).toBe(20); // floor(20.02) = 20
  });
});

describe("statusViewHeight", () => {
  it("subtracts the reserved chrome and applies the floor", () => {
    expect(statusViewHeight(40, { min: 6, reserved: 13 })).toBe(27);
    expect(statusViewHeight(10, { min: 6, reserved: 13 })).toBe(6);
  });

  it("applies an optional ceiling", () => {
    expect(statusViewHeight(40, { min: 3, max: 10, reserved: 12 })).toBe(10);
    expect(statusViewHeight(20, { min: 3, max: 10, reserved: 12 })).toBe(8);
    expect(statusViewHeight(10, { min: 3, max: 10, reserved: 12 })).toBe(3);
  });
});

describe("clampWidth / clampHeight", () => {
  it("never exceeds the terminal and respects the minimum when it fits", () => {
    expect(clampWidth(100, 56)).toBe(56);
    expect(clampWidth(30, 56)).toBe(28);
    expect(clampWidth(20, 56, 24)).toBe(18);
    expect(clampWidth(10, 56, 24)).toBe(8);
  });

  it("clamps height with a 2-row margin", () => {
    expect(clampHeight(40, 24)).toBe(24);
    expect(clampHeight(10, 24)).toBe(8);
    expect(clampHeight(4, 24)).toBe(4);
  });
});
