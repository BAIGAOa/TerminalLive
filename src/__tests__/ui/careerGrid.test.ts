import { describe, it, expect } from "vitest";
import {
  CARD_H,
  CARD_SHAPES,
  cardHeight,
  computeCareerGrid,
} from "../../ui/careerGrid.js";

describe("computeCareerGrid", () => {
  it("lays a 12-card board out as 4×3 on a wide, short panel", () => {
    // 64 usable columns, 17 usable rows → 3 rows of cards fit, 4 columns wide.
    const layout = computeCareerGrid(64, 17, 12);
    expect(layout.size).toBe("full");
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
    // take two pages instead of being crushed twice as small.
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

  it("drops to a single column when the panel is too narrow for two", () => {
    const layout = computeCareerGrid(12, 20, 6);
    expect(layout.size).toBe("line");
    expect(layout.cols).toBe(1);
    expect(layout.cardW).toBe(12);
    expect(layout.pages).toBe(1);
  });

  it("never reports zero pages for an empty board", () => {
    const layout = computeCareerGrid(64, 17, 0);
    expect(layout.pages).toBe(1);
    expect(layout.rows).toBeGreaterThanOrEqual(1);
  });
});

describe("the card shape adapts to the space", () => {
  it("keeps the richest cards on a roomy terminal", () => {
    expect(computeCareerGrid(90, 20, 14).size).toBe("full");
  });

  it("still picks full cards on a standard 80×24 terminal, and scrolls", () => {
    // 72 columns of board, 11 usable rows: two rows of cards, two pages. The
    // alternative — one-line rows that fit at once — would throw away the card
    // grid a normal terminal can comfortably afford.
    const layout = computeCareerGrid(72, 11, 14);
    expect(layout.size).toBe("full");
    expect(layout.cols).toBe(4);
    expect(layout.rows).toBe(2);
    expect(layout.pages).toBe(2);
  });

  it("drops the extra card lines before the border", () => {
    const layout = computeCareerGrid(64, 7, 14);
    expect(layout.size).toBe("compact");
    expect(layout.cardH).toBe(3);
  });

  it("drops the border once even a compact card cannot fit", () => {
    const layout = computeCareerGrid(52, 5, 14);
    expect(layout.size).toBe("line");
    expect(layout.cardH).toBe(1);
    expect(layout.pages).toBe(1);
  });

  it("prefers a denser card over a shape that would page too far", () => {
    // Full cards fit on this panel, but only four at a time — four pages for
    // fourteen jobs. One-line rows show the whole board instead.
    const layout = computeCareerGrid(64, 4, 14);
    expect(layout.size).toBe("line");
    expect(layout.pages).toBe(1);
  });
});

describe("the board never outgrows the space it was given", () => {
  it("keeps the cards inside the available rows at every size", () => {
    for (const cols of [30, 50, 72, 90, 120]) {
      for (let rows = 2; rows <= 30; rows++) {
        const layout = computeCareerGrid(cols, rows, 14);
        expect(layout.rows * layout.cardH).toBeLessThanOrEqual(rows);
      }
    }
  });

  it("never hands a taller card to a shorter panel", () => {
    // Monotonic degradation: shrinking the terminal may only make the card
    // denser, never richer. An inversion here is what made a slightly smaller
    // terminal show a worse board than a slightly larger one.
    let previous = Infinity;
    for (let rows = 30; rows >= 2; rows--) {
      const height = computeCareerGrid(90, rows, 14).cardH;
      expect(height).toBeLessThanOrEqual(previous);
      previous = height;
    }
  });

  it("keeps every shape's height in step with the layout's report", () => {
    for (const shape of CARD_SHAPES) {
      expect(cardHeight(shape.size)).toBe(shape.height);
    }
  });
});
