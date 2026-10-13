/**
 * Layout and read-out rules for the character sheet.
 *
 * React-free on purpose: how many columns fit, which block lands in which
 * column, and whether a number should look alarming are all decisions worth
 * testing without a terminal. The view is then a renderer over this.
 */

/** How a number should read at a glance. */
export type Tone = "good" | "warn" | "bad" | "neutral";

/** Cells between columns. */
const GAP = 2;

/**
 * Narrowest a column may be and still hold a row of readings.
 *
 * A column carries two `label value` cells side by side, and the widest of them
 * — an active effect, `▲ 🍀 福星高照 剩 3 年` — needs about sixteen cells. Under
 * this a column does not wrap, it *truncates*: the sheet would show `暴怒 …`
 * and quietly drop the duration. A floor that only counts columns, not their
 * contents, produces exactly that.
 */
export const MIN_COLUMN_W = 34;

/**
 * How many columns of a sheet fit in `availCols`.
 *
 * One wide column is a wall of text; three narrow ones are unreadable. The
 * sheet wants two or three when the panel allows it, because a character sheet
 * is scanned, not read — but only when each column is still wide enough to say
 * something.
 */
export function sheetColumnCount(
  availCols: number,
  minColumn = MIN_COLUMN_W,
  max = 3,
): number {
  const fits = Math.floor((availCols + GAP) / (minColumn + GAP));
  return Math.max(1, Math.min(max, fits));
}

/** A block of the sheet, measured in rendered rows. */
export interface SheetBlock {
  id: string;
  /** Rows this block occupies, including its heading. */
  rows: number;
}

/**
 * Distribute whole blocks across `columns`, balancing their heights.
 *
 * Sections are never split across a column break — a heading at the foot of one
 * column with its content at the top of the next reads as two lists. So this
 * fills greedily, always into whichever column is currently shortest, which
 * balances well for the handful of blocks a sheet has.
 *
 * Returns block ids per column, in the order they were assigned.
 */
export function packColumns(
  blocks: readonly SheetBlock[],
  columns: number,
): string[][] {
  const count = Math.max(1, Math.floor(columns));
  const out: string[][] = Array.from({ length: count }, () => []);
  if (count === 1) return [blocks.map((b) => b.id)];

  const heights = new Array<number>(count).fill(0);
  for (const block of blocks) {
    let shortest = 0;
    for (let i = 1; i < count; i++) {
      if (heights[i] < heights[shortest]) shortest = i;
    }
    out[shortest].push(block.id);
    heights[shortest] += block.rows;
  }
  return out;
}

/**
 * Lay items out `perRow` to a line.
 *
 * A sheet spends its width on more facts per line rather than on longer bars —
 * that is the whole point of dropping the gauges.
 */
export function pairItems<T>(items: readonly T[], perRow = 2): T[][] {
  const width = Math.max(1, Math.floor(perRow));
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += width) {
    rows.push(items.slice(i, i + width));
  }
  return rows;
}

/** Cells the widest reading needs before it starts being cut off. */
export const MIN_CELL_W = 16;

/**
 * How many readings fit on a line inside a column of `columnW`.
 *
 * Two is the intent; one is what a narrow column can honestly hold. Asking for
 * two regardless is how a cell ends up narrower than its own text, which reads
 * as data quietly missing rather than as a cramped panel.
 */
export function cellsPerRow(columnW: number, wanted = 2): number {
  if (wanted <= 1) return 1;
  // The gap before each cell after the first.
  const needed = wanted * MIN_CELL_W + (wanted - 1) * 2;
  return columnW >= needed ? wanted : cellsPerRow(columnW, wanted - 1);
}

/** A gauge where higher is better: health, happiness, a skill. */
export function gaugeTone(value: number): Tone {
  if (value < 25) return "bad";
  if (value < 50) return "warn";
  return "good";
}

/**
 * A gauge where higher is worse: anger, depression, an illness.
 *
 * Deliberately not `invert(gaugeTone)`: the bands are the player's problem at
 * different points. Being at 40 health is a warning; being at 40 anger is not.
 */
export function burdenTone(value: number): Tone {
  if (value > 70) return "bad";
  if (value > 40) return "warn";
  return "neutral";
}

/** A reading that is only ever a fact: money, age, height. */
export function plainTone(): Tone {
  return "neutral";
}
