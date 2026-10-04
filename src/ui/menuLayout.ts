export interface MenuLayout {
  /** Number of grid columns. */
  cols: number;
  /** Uniform cell width (also the button width). */
  btnW: number;
  /** Whether the big ASCII logo fits; otherwise a one-line title is used. */
  showLogo: boolean;
}

const GAP = 2;
const MIN_BTN = 10;
const MAX_BTN = 18;
/** A bordered button occupies 3 terminal rows. */
const BUTTON_ROWS = 3;
/** Rows the big ASCII logo (11 lines) needs, plus its margin. */
const LOGO_ROWS = 14;
/** Rows lost to a one-line title and root padding when the logo is hidden. */
const SMALL_CHROME = 4;
const MAX_COLS = 3;

function preferredCols(avail: number): number {
  for (const n of [3, 2]) {
    if (n * MAX_BTN + (n - 1) * GAP <= avail) return n;
  }
  return 1;
}

function colsForHeight(
  avail: number,
  rows: number,
  itemCount: number,
  reserved: number,
): number {
  const maxRows = Math.max(1, Math.floor((rows - reserved) / BUTTON_ROWS));
  const maxColsByWidth = Math.max(
    1,
    Math.min(MAX_COLS, Math.floor((avail + GAP) / (MIN_BTN + GAP))),
  );
  let cols = preferredCols(avail);
  while (cols < maxColsByWidth && Math.ceil(itemCount / cols) > maxRows) cols++;
  return cols;
}

/**
 * Pick a menu grid for the current terminal: full-width buttons fan out into
 * 3 → 2 → 1 columns as the terminal narrows. If either the ASCII logo or the
 * list would run off the bottom, the layout first pulls in extra columns
 * (shrinking buttons) and, if that still won't fit, drops to a one-line title.
 */
export function computeMenuLayout(
  termCols: number,
  termRows: number,
  itemCount: number,
): MenuLayout {
  const avail = Math.max(MIN_BTN, termCols - 4);
  const rows = Number.isFinite(termRows) && termRows > 0 ? termRows : Infinity;
  const wideEnough = termCols >= 50;

  let cols = colsForHeight(avail, rows, itemCount, wideEnough ? LOGO_ROWS : SMALL_CHROME);
  const menuRows = Math.ceil(itemCount / cols) * BUTTON_ROWS;
  const showLogo = wideEnough && menuRows <= rows - LOGO_ROWS;
  if (!showLogo && wideEnough) {
    cols = colsForHeight(avail, rows, itemCount, SMALL_CHROME);
  }

  const btnW = Math.max(
    MIN_BTN,
    Math.min(MAX_BTN, Math.floor((avail - (cols - 1) * GAP) / cols)),
  );

  return { cols, btnW, showLogo };
}
