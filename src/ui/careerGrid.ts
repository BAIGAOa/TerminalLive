/**
 * Pure layout maths for the career board.
 *
 * Kept React-free so the "does this fit as 4×3 or 3×4" arithmetic can be
 * unit-tested without rendering (see `src/__tests__/ui/careerGrid.test.ts`).
 * It only decides the *shape*; the grid itself is drawn by `MenuList`, which
 * already handles arrow keys, Enter and mouse for `columns × columnWidth`.
 */

/** A bordered card occupies this many rows: top border, 3 body lines, bottom. */
export const CARD_H = 5;
const MIN_CARD_W = 14;
const MAX_COLS = 5;
const GAP_X = 2;
const GAP_Y = 0;

export interface CareerGridLayout {
  /** Columns per page. */
  cols: number;
  /** Rows used — trimmed to what the cards need, never a blank trailing row. */
  rows: number;
  /** Width of one card, including its border. */
  cardW: number;
  cardH: number;
  /** Cards on a full page — `cols * rows`. */
  pageSize: number;
  /** Pages needed for the given card count. */
  pages: number;
}

/**
 * Pick the grid that fits `count` cards into `availCols × availRows`.
 *
 * Cards fan out into as many columns as the width allows (up to 5) and as many
 * rows as the height allows, so a wide, short terminal gets 4×3 and a narrow,
 * tall one gets 3×4. The winner is the arrangement that pages least; ties go to
 * the wider card, which keeps the board on one page whenever it can.
 */
export function computeCareerGrid(
  availCols: number,
  availRows: number,
  count: number,
): CareerGridLayout {
  const rowsFit = Math.max(1, Math.floor((availRows + GAP_Y) / (CARD_H + GAP_Y)));
  const items = Math.max(1, count);

  let best: CareerGridLayout | null = null;
  for (let cols = MAX_COLS; cols >= 2; cols--) {
    const cardW = Math.floor((availCols - (cols - 1) * GAP_X) / cols);
    if (cardW < MIN_CARD_W) continue;
    const rows = Math.min(rowsFit, Math.ceil(items / cols));
    const pageSize = cols * rows;
    const layout: CareerGridLayout = {
      cols,
      rows,
      cardW,
      cardH: CARD_H,
      pageSize,
      pages: Math.max(1, Math.ceil(items / pageSize)),
    };
    // Scan cols downwards and replace only on a strict win, so the first
    // (widest) candidate survives a tie.
    if (!best || layout.pages < best.pages || layout.pageSize > best.pageSize) {
      best = layout;
    }
  }

  if (best) return best;

  // Too narrow for two columns — a single column of full-width cards.
  const rows = Math.min(rowsFit, items);
  return {
    cols: 1,
    rows,
    cardW: Math.max(MIN_CARD_W, availCols),
    cardH: CARD_H,
    pageSize: rows,
    pages: Math.max(1, Math.ceil(items / rows)),
  };
}
