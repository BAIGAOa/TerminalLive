import { describe, it, expect } from "vitest";
import { computeMenuLayout } from "../../ui/menuLayout.js";

const ITEMS = 9;

describe("computeMenuLayout", () => {
  it("uses 3 full-width columns on a wide terminal", () => {
    const l = computeMenuLayout(100, 40, ITEMS);
    expect(l.cols).toBe(3);
    expect(l.btnW).toBe(18);
    expect(l.showLogo).toBe(true);
  });

  it("drops to 2 columns when 3 no longer fit the width", () => {
    const l = computeMenuLayout(60, 40, ITEMS);
    expect(l.cols).toBe(2);
    expect(l.btnW).toBe(18);
    expect(l.showLogo).toBe(true);
  });

  it("hides the ASCII logo and uses 2 columns on a narrow terminal", () => {
    const l = computeMenuLayout(42, 40, ITEMS);
    expect(l.cols).toBe(2);
    expect(l.showLogo).toBe(false);
  });

  it("widens the grid to stay on a short screen", () => {
    const l = computeMenuLayout(28, 30, ITEMS);
    expect(l.cols).toBe(2);
    expect(l.btnW).toBeLessThan(18);
    expect(l.showLogo).toBe(false);
  });

  it("falls back to a single column on a very narrow terminal", () => {
    const l = computeMenuLayout(20, 40, ITEMS);
    expect(l.cols).toBe(1);
    expect(l.showLogo).toBe(false);
  });

  it("drops the logo when the terminal is too short for it", () => {
    // Wide but short: the 11-line logo must yield to the list.
    const l = computeMenuLayout(100, 14, ITEMS);
    expect(l.showLogo).toBe(false);
  });

  it("never returns fewer than 1 column", () => {
    expect(computeMenuLayout(5, 5, ITEMS).cols).toBeGreaterThanOrEqual(1);
  });
});
