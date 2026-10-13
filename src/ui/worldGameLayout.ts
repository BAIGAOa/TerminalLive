/** Pure layout math for the {@link WorldGame} screen. Kept React-free so the
 * size-driven arithmetic can be unit-tested without rendering. */

export interface WorldGameLayout {
  /** Help text lines (3 / 2 / 1) the bottom footer may draw. */
  hintH: number;
  /** True on a short terminal: the journal drops its prose "scene" row. */
  short: boolean;
  /** Width of the actions column, borders included. */
  actionsW: number;
  /**
   * Cells the action panel's *contents* may use — `actionsW` less its border
   * and padding.
   */
  actionsInnerW: number;
  /**
   * Cells the status view may use.
   *
   * The status panel is whatever the middle row has left over, so its width is
   * only knowable here. A view that measures the terminal instead draws far
   * wider than the box it was handed, and ink clips the excess at the screen
   * edge — which reads as text cut off mid-word rather than as anything a
   * layout check would flag.
   */
  carouselInnerW: number;
  /** Height of the journal block (0 when there is no room for it). */
  journalH: number;
  showJournal: boolean;
  /** Height of the actions | status middle row. */
  middleH: number;
  /** Rows the active status view may draw (minus the carousel chrome). */
  carouselContentH: number;
  /** Usable rows inside the journal once its chrome is removed. */
  journalInner: number;
  /** Clamped offset for the journal's End key (newest = 0). */
  maxJournalOffset: number;
}

const HINT_3 = 22;
const HINT_2 = 16;
const CHROME = 2 /*padding*/ + 3 /*header*/ + 3 /*marginTops*/;
/** Each bordered panel spends 2 cells on its border and 2 on `paddingX`. */
const PANEL_CHROME = 4;
/** The actions column's `marginRight`. */
const COLUMN_GAP = 1;
/** The screen's own `padding`, both sides. */
const ROOT_PADDING = 2;

/**
 * Deterministic, size-driven layout for the game screen. The middle row
 * (actions | status) and the journal share the rows left after the fixed
 * chrome; the help text shrinks from 3 to 2 to 1 lines as rows run out.
 */
export function computeWorldGameLayout(
  rows: number,
  columns: number,
  victoryCount: number,
  logCount: number,
): WorldGameLayout {
  const safeRows = Math.max(1, rows);
  const hintH = safeRows >= HINT_3 ? 3 : safeRows >= HINT_2 ? 2 : 1;
  const short = safeRows < 26;
  const actionsW = Math.max(18, Math.min(38, Math.floor(columns * 0.34)));

  const avail = Math.max(4, safeRows - CHROME - hintH);
  let journalH = 0;
  if (avail >= 12) {
    journalH = Math.min(9, Math.max(4, Math.round(avail * 0.3)));
  }
  const showJournal = journalH >= 4;
  const middleH = Math.max(4, avail - (showJournal ? journalH : 0));
  const carouselContentH = Math.max(3, middleH - 3 - victoryCount);
  const journalInner = Math.max(1, journalH - (short ? 3 : 5));
  const maxJournalOffset = Math.max(0, logCount - journalInner);

  // The middle row is the root's content minus the actions column and its gap;
  // each panel then loses its own border and padding. Floored so a very narrow
  // terminal still hands the views something drawable rather than a negative.
  const rowW = Math.max(8, columns - ROOT_PADDING);
  const actionsInnerW = Math.max(6, actionsW - PANEL_CHROME);
  const carouselInnerW = Math.max(
    8,
    rowW - actionsW - COLUMN_GAP - PANEL_CHROME,
  );

  return {
    hintH,
    short,
    actionsW,
    actionsInnerW,
    carouselInnerW,
    journalH,
    showJournal,
    middleH,
    carouselContentH,
    journalInner,
    maxJournalOffset,
  };
}
