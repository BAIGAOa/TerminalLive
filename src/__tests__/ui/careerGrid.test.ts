import { describe, it, expect } from "vitest";
import { CARD_H, computeCareerGrid } from "../../ui/careerGrid.js";

describe("computeCareerGrid", () => {
  it("lays a 12-card board out as 4×3 on a wide, short panel", () => {
    // 64 usable columns, 17 usable rows → 3 rows of cards fit, 4 columns wide.
    const layout = computeCareerGrid(64, 17, 12);
    expect(layout.cols).toBe(4);
    expect(layout.rows).toBe(3);
    expect(layout.pageSize).toBe(12);
    expect(layout.pages).toBe(1);
    expect(layout.cardH).toBe(CARD_H);
  });

  it("flips to 3×4 when the panel is narrow but tall", () => {
    const layout = computeCareerGrid(50, 22, 12);
    expect(layout.cols).toBe(3);
    expect(layout.rows).toBe(4);
    expect(layout.pageSize).toBe(12);
    expect(layout.pages).toBe(1);
  });

  it("pages the board rather than shrinking cards below the minimum width", () => {
    // 60 usable columns: only 3 columns clear the 14-cell floor, so 14 cards
    // need two pages instead of being crushed twice as small.
    const layout = computeCareerGrid(60, 17, 14);
    expect(layout.cols).toBe(3);
    expect(layout.pages).toBe(2);
    expect(layout.cardW).toBeGreaterThanOrEqual(14);
  });

  it("trims unused rows so a short board leaves no blank row", () => {
    const layout = computeCareerGrid(64, 17, 3);
    expect(layout.rows).toBe(1);
    expect(layout.pages).toBe(1);
  });

  it("falls back to a single column when the panel is too narrow for two", () => {
    const layout = computeCareerGrid(12, 20, 6);
    expect(layout.cols).toBe(1);
    expect(layout.cardW).toBe(Math.max(14, 12));
    // 20 rows of space, 4 cards of 5 rows each.
    expect(layout.rows).toBe(4);
  });

  it("never reports zero pages for an empty board", () => {
    const layout = computeCareerGrid(64, 17, 0);
    expect(layout.pages).toBe(1);
    expect(layout.rows).toBeGreaterThanOrEqual(1);
  });
});
