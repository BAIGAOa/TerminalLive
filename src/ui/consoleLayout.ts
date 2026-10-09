import { clampHeight, clampWidth } from "./kit/viewport.js";
import { CommandDescription } from "../core/repl/ReplDescribe.js";

/** Pure layout math for the control console modal — kept React-free so it can
 * be unit-tested. `clampHeight`/`clampWidth` are the same clamps
 * {@link ModalFrame} uses, so the inner layout always exactly fills the frame. */

/** Most completion rows drawn; the menu scrolls once there are more. */
const MAX_COMP_ROWS = 6;
/** Results rows kept visible, so a long menu never swallows the whole panel. */
const MIN_RESULTS_ROWS = 4;
/** Frame chrome: border 2 + paddingY 2 + title 2. */
const FRAME_CHROME = 6;

export interface ConsoleLayoutInput {
  /** Terminal rows. */
  rows: number;
  /** Terminal columns (the frame is clamped to them, so the text width is too). */
  columns: number;
  /** Desired panel height before clamping. */
  desiredH: number;
  /** Desired panel width before clamping. */
  desiredW: number;
  /** Number of pending notifications. */
  notifications: number;
  /** Number of completion candidates. */
  completions: number;
  /** Whether the console is in text-input mode (completion list shown). */
  inputMode: boolean;
  /** Command help drawn under the input, if any. */
  description?: CommandDescription | null;
}

export interface ConsoleLayout {
  /** The modal frame's actual (clamped) height. */
  modalH: number;
  /** Rows available for the console body. */
  bodyH: number;
  /** Notification rows drawn (0–2). */
  notifH: number;
  /** Blank row between notifications and the results header (0 or 1). */
  gap: number;
  /** Completion rows drawn (0–6; only in input mode). */
  compH: number;
  /** Description rows drawn under the input (0–2). */
  descH: number;
  /** Rows for the scrollable results viewport. */
  resultsH: number;
  /** Cells available for text inside the results viewport. */
  resultsW: number;
}

/** Rows the help needs under the input: usage + summary, or summary alone. */
export function descriptionRows(
  description: CommandDescription | null | undefined,
): number {
  if (!description) return 0;
  return description.usage ? 2 : 1;
}

/**
 * First candidate index of the completion window that keeps `index` visible in
 * a `size`-row menu — the menu scrolls instead of growing without bound.
 */
export function completionWindow(
  index: number,
  total: number,
  size: number,
): number {
  if (size <= 0 || total <= size) return 0;
  const centred = index - Math.floor(size / 2);
  return Math.max(0, Math.min(centred, total - size));
}

export function computeConsoleLayout({
  rows,
  columns,
  desiredH,
  desiredW,
  notifications,
  completions,
  inputMode,
  description,
}: ConsoleLayoutInput): ConsoleLayout {
  // Mirror ModalFrame's clamp: frame chrome on both axes, then the results
  // viewport's own chrome (scrollbar cell + its leading margin).
  const modalH = clampHeight(rows, desiredH, FRAME_CHROME);
  const bodyH = Math.max(1, modalH - FRAME_CHROME);
  const resultsW = Math.max(8, clampWidth(columns, desiredW, 24) - FRAME_CHROME - 2);

  const notifH = Math.min(2, notifications);
  const gap = notifH > 0 ? 1 : 0;
  // Everything above/below the menu: hint, notifications, header, input.
  const chrome = 1 + notifH + gap + 1 + 2;
  // The help hangs off the input line, so it only exists in input mode.
  const descH = inputMode ? descriptionRows(description) : 0;
  const compH = inputMode
    ? Math.max(
        0,
        Math.min(
          MAX_COMP_ROWS,
          completions,
          bodyH - chrome - descH - MIN_RESULTS_ROWS,
        ),
      )
    : 0;
  const resultsH = Math.max(1, bodyH - (chrome + compH + descH));

  return { modalH, bodyH, notifH, gap, compH, descH, resultsH, resultsW };
}
