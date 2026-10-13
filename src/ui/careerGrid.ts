/**
 * Pure layout maths for the career board.
 *
 * Kept React-free so the "does this fit as 4×3 or 3×4" arithmetic and the card
 * shape it picks can be tested without rendering. It only decides the *shape*;
 * the grid itself is drawn by `MenuList`, which owns the arrow keys, Enter,
 * mouse, and the row window it scrolls when the board is taller than its box.
 */

/** How much of a job a card can afford to show. */
export type CardSize =
  /** Bordered, three lines: name, field and mechanics, salary. */
  | "full"
  /** Bordered, one line: name and salary. The border colour carries the state. */
  | "compact"
  /** Unbordered single row: state glyph, name, salary. */
  | "line";

interface CardShape {
  size: CardSize;
  /** Rows the card occupies, borders included. */
  height: number;
  /** Narrower than this and the card's own text no longer fits. */
  minWidth: number;
}

/**
 * Card shapes, richest first.
 *
 * A border costs two of the card's rows, and on a short terminal that is a
 * fifth of the screen — so the card gives up its borders, then its extra lines,
 * before the board gives up showing jobs. Details live in the detail pane; the
 * board's job is to compare jobs, which needs breadth more than depth.
 */
export const CARD_SHAPES: readonly CardShape[] = [
  { size: "full", height: 5, minWidth: 14 },
  { size: "compact", height: 3, minWidth: 14 },
  { size: "line", height: 1, minWidth: 10 },
];

/** Height of the richest card — the shape a roomy terminal gets. */
export const CARD_H = CARD_SHAPES[0].height;

/** Rows a card of this shape occupies, so the renderer and the maths agree. */
export function cardHeight(size: CardSize): number {
  return CARD_SHAPES.find((s) => s.size === size)?.height ?? 1;
}

const MAX_COLS = 5;
const GAP_X = 2;
const GAP_Y = 0;

export interface CareerGridLayout {
  /** Which card shape this layout is for. */
  size: CardSize;
  /** Columns per page. */
  cols: number;
  /** Rows of cards — trimmed to what the cards need, never a blank trailing row. */
  rows: number;
  /** Width of one card, including its border. */
  cardW: number;
  cardH: number;
  /** Cards visible at once — `cols * rows`. */
  pageSize: number;
  /** Pages needed for the given card count. */
  pages: number;
}

interface Candidate extends CareerGridLayout {}

/** The best column count for one card shape, or null if it cannot be shown. */
function bestForShape(
  shape: CardShape,
  availCols: number,
  availRows: number,
  items: number,
): Candidate | null {
  // A shape that cannot fit even one whole row is not a candidate at all —
  // rendering it would spill out of the box, which does not clip.
  if (shape.height > availRows) return null;
  const rowsFit = Math.max(
    1,
    Math.floor((availRows + GAP_Y) / (shape.height + GAP_Y)),
  );

  let best: Candidate | null = null;
  for (let cols = MAX_COLS; cols >= 1; cols--) {
    const cardW = Math.floor((availCols - (cols - 1) * GAP_X) / cols);
    if (cardW < shape.minWidth) continue;
    const rows = Math.min(rowsFit, Math.ceil(items / cols));
    const pageSize = cols * rows;
    const cand: Candidate = {
      size: shape.size,
      cols,
      rows,
      cardW,
      cardH: shape.height,
      pageSize,
      pages: Math.max(1, Math.ceil(items / pageSize)),
    };
    // Scan cols downwards and replace only on a strict win, so the first
    // (widest) candidate survives a tie.
    if (
      !best ||
      cand.pages < best.pages ||
      (cand.pages === best.pages && cand.pageSize > best.pageSize)
    ) {
      best = cand;
    }
  }
  return best;
}

/**
 * How much paging a shape may cost before the board prefers a denser one.
 *
 * Two screens of cards is a board you can browse. Beyond that the scrolling is
 * the experience rather than the cards, and a flat list of jobs — which shows
 * them all at once — is simply better. This is what stops a terminal one row
 * short of a comfortable grid from being handed four cards and four pages.
 */
const MAX_PAGES = 2;

/**
 * Pick the board that fits `count` cards into `availCols × availRows`.
 *
 * The richest card wins, as long as the whole board stays within
 * {@link MAX_PAGES} — and whatever does not fit on screen scrolls, because
 * `MenuList` windows the grid by row. So a shape only degrades when the
 * terminal genuinely cannot seat it: borders first, then lines, jobs last.
 */
export function computeCareerGrid(
  availCols: number,
  availRows: number,
  count: number,
): CareerGridLayout {
  const items = Math.max(1, count);
  const candidates = CARD_SHAPES.map((shape) =>
    bestForShape(shape, availCols, availRows, items),
  ).filter((c): c is Candidate => c !== null);

  if (candidates.length === 0) {
    // Not even the densest card fits one row on this terminal. Render what
    // there is and let the window scroll; something has to be shown.
    const cols = Math.max(1, Math.floor((availCols + GAP_X) / (10 + GAP_X)));
    return {
      size: "line",
      cols,
      rows: 1,
      cardW: Math.max(10, Math.floor((availCols - (cols - 1) * GAP_X) / cols)),
      cardH: 1,
      pageSize: cols,
      pages: Math.max(1, Math.ceil(items / cols)),
    };
  }

  // `candidates` is richest-first, so this is the richest shape that stays
  // within the paging budget.
  const manageable = candidates.find((c) => c.pages <= MAX_PAGES);
  if (manageable) return manageable;

  // Nothing is comfortably browsable here: take the one that pages least.
  return candidates.reduce((a, b) => (b.pages < a.pages ? b : a));
}
