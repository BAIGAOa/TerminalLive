import { describe, it, expect } from "vitest";
import { computeMenuLayout, fitPanelSections } from "../../ui/menuLayout.js";

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

describe("fitPanelSections", () => {
  // Defaults: reserved 14, border 2, gap 1 → budget = rows - 28 - menuHeight.
  // Costs with gap: 3+1=4, 5+1=6, 5+1=6 (cumulative 4 / 10 / 16).
  const SECTIONS = [
    { key: "effects", height: 3 },
    { key: "progress", height: 5 },
    { key: "legend", height: 5 },
  ];
  const MENU = 12;

  it("shows every section when there is ample room", () => {
    expect(fitPanelSections(50, MENU, SECTIONS)).toEqual([
      "effects",
      "progress",
      "legend",
    ]);
  });

  it("stops after the sections that fit, in priority order", () => {
    expect(fitPanelSections(40, MENU, SECTIONS)).toEqual(["effects", "progress"]);
    expect(fitPanelSections(34, MENU, SECTIONS)).toEqual(["effects"]);
  });

  it("includes a section when the budget is exactly its cost", () => {
    expect(fitPanelSections(38, MENU, SECTIONS)).toEqual(["effects", "progress"]);
    expect(fitPanelSections(32, MENU, SECTIONS)).toEqual(["effects"]);
  });

  it("hides the panel when even the first section will not fit", () => {
    expect(fitPanelSections(24, MENU, SECTIONS)).toEqual([]);
  });

  it("never emits sections for a tiny or overflowing layout", () => {
    expect(fitPanelSections(5, MENU, SECTIONS)).toEqual([]);
    expect(fitPanelSections(0, 0, SECTIONS)).toEqual([]);
  });

  it("honors overrides for reserved rows, border and gap", () => {
    // budget = 30 - 10 - 6 - 0 = 14; costs without gap: 3, 5, 5 → 3+5=8, +5=13.
    expect(
      fitPanelSections(30, 6, SECTIONS, {
        reservedRows: 10,
        panelBorder: 0,
        gap: 0,
      }),
    ).toEqual(["effects", "progress", "legend"]);
  });
});
