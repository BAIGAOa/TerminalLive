import React from "react";
import { Box, Text } from "ink";

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
