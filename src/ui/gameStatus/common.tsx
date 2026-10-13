import React from "react";
import { useWindowSize } from "ink";
import { ScrollPanel } from "../kit/index.js";
import { statusViewHeight } from "../kit/viewport.js";

// Re-exported so existing status views can keep importing `bar` from here.
export { bar } from "../kit/viewport.js";

/**
 * Fixed-height, wheel-scrollable viewport for a status view. `lines` must hold
 * exactly one entry per rendered row (use `null` for a spacer). When
 * `height` is omitted it falls back to a terminal-relative estimate.
 *
 * There is no labelled-gauge component here any more: the character sheet reads
 * its numbers directly, because a bar spends twenty cells to say one figure.
 * Views that are showing *progress toward something* (a career rung, an
 * affinity) still use `bar` for a short inline meter.
 */
export function StatusScroll({
  height,
  lines,
}: {
  height?: number;
  lines: React.ReactNode[];
}) {
  const { rows } = useWindowSize();
  const viewH = Math.max(
    1,
    height ?? statusViewHeight(rows, { min: 6, reserved: 13 }),
  );
  // Only draw the scrollbar when the content actually overflows.
  return <ScrollPanel height={viewH} lines={lines} showBar={lines.length > viewH} />;
}
