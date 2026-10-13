import { describe, it, expect } from "vitest";
import {
  MIN_CELL_W,
  MIN_COLUMN_W,
  burdenTone,
  cellsPerRow,
  gaugeTone,
  packColumns,
  pairItems,
  sheetColumnCount,
} from "../../ui/gameStatus/sheetLayout.js";

describe("sheetColumnCount", () => {
  it("gives a very wide panel three columns", () => {
    expect(sheetColumnCount(128)).toBe(3);
  });

  it("drops to two, then one, as the panel narrows", () => {
    expect(sheetColumnCount(72)).toBe(2);
    expect(sheetColumnCount(52)).toBe(1);
  });

  it("never returns zero columns", () => {
    expect(sheetColumnCount(0)).toBe(1);
    expect(sheetColumnCount(10)).toBe(1);
  });

  it("refuses a column too narrow to hold a row of readings", () => {
    // Two cells of `MIN_CELL_W` plus the gap between them. Below that a column
    // does not wrap, it truncates — which is how an active effect came to read
    // `暴怒 …` with its duration silently missing.
    expect(MIN_COLUMN_W).toBeGreaterThanOrEqual(2 * MIN_CELL_W + 2);
    for (let avail = 0; avail <= 200; avail++) {
      const cols = sheetColumnCount(avail);
      const columnW = Math.floor((avail - (cols - 1) * 2) / cols);
      if (columnW >= 2 * MIN_CELL_W + 2) continue;
      // A column this narrow is only allowed when there is no room for fewer.
      expect(cols).toBe(1);
    }
  });
});

describe("cellsPerRow", () => {
  it("asks for two when the column can hold two", () => {
    expect(cellsPerRow(45)).toBe(2);
  });

  it("settles for one rather than cutting both cells in half", () => {
    expect(cellsPerRow(27)).toBe(1);
    expect(cellsPerRow(12)).toBe(1);
  });

  it("never returns zero, however narrow the column", () => {
    for (const w of [0, 1, 5, 20, 100]) {
      expect(cellsPerRow(w)).toBeGreaterThanOrEqual(1);
    }
  });

  it("gives every cell at least the width its widest reading needs", () => {
    for (let columnW = 8; columnW <= 120; columnW += 1) {
      const perRow = cellsPerRow(columnW);
      const cellW = Math.floor(columnW / perRow);
      expect(cellW).toBeGreaterThanOrEqual(
        perRow === 1 ? 1 : MIN_CELL_W,
      );
    }
  });
});

describe("packColumns", () => {
  const blocks = [
    { id: "overview", rows: 3 },
    { id: "stats", rows: 6 },
    { id: "mind", rows: 6 },
    { id: "effects", rows: 3 },
    { id: "health", rows: 3 },
  ];

  it("keeps every block, exactly once", () => {
    const packed = packColumns(blocks, 3).flat();
    expect(packed.sort()).toEqual(blocks.map((b) => b.id).sort());
  });

  it("never splits a block across a column break", () => {
    const packed = packColumns(blocks, 3);
    for (const column of packed) {
      expect(new Set(column).size).toBe(column.length);
    }
  });

  it("balances the columns by height", () => {
    const heights = packColumns(blocks, 3).map((ids) =>
      ids.reduce((sum, id) => sum + (blocks.find((b) => b.id === id)?.rows ?? 0), 0),
    );
    const spread = Math.max(...heights) - Math.min(...heights);
    // 21 rows over 3 columns cannot be even, but it should be close.
    expect(spread).toBeLessThanOrEqual(3);
  });

  it("puts everything in one column when asked for one", () => {
    expect(packColumns(blocks, 1)).toEqual([blocks.map((b) => b.id)]);
  });

  it("survives asking for more columns than there are blocks", () => {
    const packed = packColumns([{ id: "only", rows: 4 }], 3);
    expect(packed).toHaveLength(3);
    expect(packed.flat()).toEqual(["only"]);
  });

  it("returns one empty column for an empty sheet", () => {
    expect(packColumns([], 2)).toEqual([[], []]);
  });
});

describe("pairItems", () => {
  it("lays items out two to a line", () => {
    expect(pairItems([1, 2, 3, 4, 5])).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("honours a different width", () => {
    expect(pairItems([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });
});

describe("tone", () => {
  it("calls out a low gauge as a problem", () => {
    expect(gaugeTone(10)).toBe("bad");
    expect(gaugeTone(30)).toBe("warn");
    expect(gaugeTone(80)).toBe("good");
  });

  it("calls out a high burden as the problem instead", () => {
    expect(burdenTone(90)).toBe("bad");
    expect(burdenTone(50)).toBe("warn");
    expect(burdenTone(10)).toBe("neutral");
  });

  it("does not treat the two kinds as mirror images", () => {
    // 40 health is a warning worth acting on; 40 anger is not yet alarming.
    expect(gaugeTone(40)).toBe("warn");
    expect(burdenTone(40)).toBe("neutral");
  });
});
