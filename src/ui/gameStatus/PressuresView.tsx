import React, { useSyncExternalStore } from "react";
import { Box, Text } from "ink";
import { container } from "../../Container.js";
import PressureState from "../../world/pressures/PressureState.js";
import { PRESSURE_CLASSES } from "../../world/pressures/PressureDefinition.js";
import { ScrollPanel } from "../kit/index.js";
import { useTerminalSize } from "../TerminalSizeContext.js";

const CLASS_COLOR: Record<string, string> = {
  nature: "green",
  society: "yellow",
  economy: "cyan",
  culture: "magenta",
  supernatural: "blue",
  meta: "whiteBright",
};

/** The hidden-score web: every "pressure" the world quietly rides on. */
export default function PressuresView({
  t,
  height,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Rows the status carousel gives this view. */
  height?: number;
}) {
  const pressures = container.resolve(PressureState);
  const { rows } = useTerminalSize();
  useSyncExternalStore(pressures.subscribe, pressures.getSnapshot);

  const lines: React.ReactNode[] = [
    <Text color="cyan" bold key="__title">
      {t("pressures.title")}
    </Text>,
  ];

  for (const cls of PRESSURE_CLASSES) {
    const axes = pressures.axesOf(cls);
    if (axes.length === 0) continue;
    lines.push(
      <Text dimColor key={`__h_${cls}`}>
        ── {t(`pressure.class.${cls}`)} ──
      </Text>,
    );
    for (const [def, value] of axes) {
      lines.push(
        <Text key={def.id}>
          {def.icon ?? "•"} {t(def.labelKey)}:{" "}
          <Text color={CLASS_COLOR[cls] ?? "white"}>{Math.round(value)}</Text>
        </Text>,
      );
    }
  }

  // Window the list to the height the carousel actually allots — never the
  // whole terminal, which used to leave the panel taller than its box and hide
  // the bottom rows on a short screen. Drop the hint first when very cramped.
  const viewH = Math.max(1, height ?? Math.max(6, rows - 13));
  const showHint = viewH >= 3;
  const panelH = Math.max(1, viewH - (showHint ? 2 : 0));

  return (
    <Box flexDirection="column" height={viewH}>
      {showHint ? (
        <Box marginBottom={1}>
          <Text dimColor>{t("pressures.hint")}</Text>
        </Box>
      ) : null}
      <ScrollPanel height={panelH} lines={lines} />
    </Box>
  );
}
