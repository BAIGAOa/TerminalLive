/** Small layout helpers shared by screens so everything fits the terminal. */

/**
 * Clamp a desired panel width to the terminal, leaving a 2-column margin.
 * Never returns something wider than the terminal, and not smaller than `min`
 * unless the terminal itself is narrower than `min`.
 */
export function clampWidth(columns: number, desired: number, min = 16): number {
  const avail = Math.max(8, columns - 2);
  return Math.max(Math.min(min, avail), Math.min(desired, avail));
}

/** Clamp a desired height to the terminal, leaving a 2-row margin. */
export function clampHeight(rows: number, desired: number, min = 6): number {
  const avail = Math.max(4, rows - 2);
  return Math.max(Math.min(min, avail), Math.min(desired, avail));
}

/**
 * A horizontal gauge string of `width` cells: `filled` cells of `█` followed
 * by `░` padding. `value` is clamped to `[0, max]` before scaling, so an
 * out-of-range value never overflows the bar.
 */
export function bar(value: number, width = 18, max = 100): string {
  const clamped = Math.max(0, Math.min(max, value));
  const filled = Math.round((clamped / max) * width);
  return "█".repeat(filled) + "░".repeat(Math.max(0, width - filled));
}

/** Responsive StatBar width: ~22% of the terminal, held to 8–20 cells. */
export function barWidthFor(columns: number): number {
  return Math.max(8, Math.min(20, Math.floor(columns * 0.22)));
}

export interface StatusViewHeightOptions {
  /** Floor, so a view stays usable on a very short terminal. */
  min: number;
  /** Rows of chrome (headers, hints, padding) the view must leave behind. */
  reserved: number;
  /** Optional ceiling when a view should not grow on a tall terminal. */
  max?: number;
}

/**
 * Height for a status view: the terminal rows minus the chrome it must leave
 * behind, floored at `min` and (optionally) capped at `max`. Replaces the
 * scattered `Math.max(min, rows - reserved)` formulas across the screens.
 */
export function statusViewHeight(
  rows: number,
  { min, reserved, max }: StatusViewHeightOptions,
): number {
  const raw = Math.max(min, rows - reserved);
  return max === undefined ? raw : Math.min(max, raw);
}
