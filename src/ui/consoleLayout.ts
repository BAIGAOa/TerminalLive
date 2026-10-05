import { clampHeight } from "./kit/viewport.js";

/** Pure layout math for the control console modal — kept React-free so it can
 * be unit-tested. `clampHeight` is the same clamp {@link ModalFrame} uses, so
 * the inner layout always exactly fills the frame. */

export interface ConsoleLayoutInput {
  /** Terminal rows. */
  rows: number;
  /** Desired panel height before clamping. */
  desiredH: number;
  /** Number of pending notifications. */
  notifications: number;
  /** Number of completion candidates. */
  completions: number;
  /** Whether the console is in text-input mode (completion list shown). */
  inputMode: boolean;
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
  /** Completion rows drawn (0–4; only in input mode). */
  compH: number;
  /** Rows for the scrollable results viewport. */
  resultsH: number;
}

export function computeConsoleLayout({
  rows,
  desiredH,
  notifications,
  completions,
  inputMode,
}: ConsoleLayoutInput): ConsoleLayout {
  // Mirror ModalFrame's clamp (border 2 + paddingY 2 + title 2 = 6 rows chrome).
  const modalH = clampHeight(rows, desiredH, 6);
  const bodyH = Math.max(1, modalH - 6);

  const notifH = Math.min(2, notifications);
  const gap = notifH > 0 ? 1 : 0;
  const compH = inputMode ? Math.min(4, completions) : 0;
  const resultsH = Math.max(
    1,
    bodyH -
      (1 /*hint*/ +
        notifH +
        gap +
        1 /*header*/ +
        2 /*input+margin*/ +
        compH),
  );

  return { modalH, bodyH, notifH, gap, compH, resultsH };
}
