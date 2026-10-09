import React, { useSyncExternalStore } from "react";
import { Box, Text, useWindowSize } from "ink";
import { container } from "../../Container.js";
import PressureState from "../../world/pressures/PressureState.js";
import { PRESSURE_CLASSES } from "../../world/pressures/PressureDefinition.js";
import { ScrollPanel } from "../kit/index.js";
import { statusViewHeight } from "../kit/viewport.js";
import { CLASS_COLOR } from "./palettes.js";

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
  const { rows } = useWindowSize();
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
  const viewH = Math.max(
    1,
    height ?? statusViewHeight(rows, { min: 6, reserved: 13 }),
  );
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
