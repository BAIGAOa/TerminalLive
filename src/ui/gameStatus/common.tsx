import React from "react";
import { Box, Text } from "ink";
import { ScrollPanel } from "../kit/index.js";
import { useTerminalSize } from "../TerminalSizeContext.js";

/**
 * Fixed-height, wheel-scrollable viewport for a status view. `lines` must hold
 * exactly one entry per rendered row (use `null` for a spacer). When
 * `height` is omitted it falls back to a terminal-relative estimate.
 */
export function StatusScroll({
  height,
  lines,
}: {
  height?: number;
  lines: React.ReactNode[];
}) {
  const { rows } = useTerminalSize();
  const viewH = Math.max(1, height ?? Math.max(6, rows - 13));
  // Only draw the scrollbar when the content actually overflows.
  return <ScrollPanel height={viewH} lines={lines} showBar={lines.length > viewH} />;
}

export function bar(value: number, width = 18, max = 100): string {
  const clamped = Math.max(0, Math.min(max, value));
  const filled = Math.round((clamped / max) * width);
  return "█".repeat(filled) + "░".repeat(Math.max(0, width - filled));
}

export function StatBar({
  label,
  value,
  color,
  width = 18,
  max = 100,
  suffix = "%",
  labelWidth = 16,
}: {
  label: string;
  value: number;
  color: string;
  width?: number;
  max?: number;
  suffix?: string;
  labelWidth?: number;
}) {
  return (
    <Box flexDirection="row">
      <Box width={labelWidth}>
        <Text>{label}</Text>
      </Box>
      <Text color={color}>{bar(value, width, max)}</Text>
      <Text>
        {" "}
        {Math.round(value)}
        {suffix}
      </Text>
    </Box>
  );
}
