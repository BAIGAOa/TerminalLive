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
