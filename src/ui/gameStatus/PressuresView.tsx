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
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
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

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text dimColor>{t("pressures.hint")}</Text>
      </Box>
      <ScrollPanel height={Math.max(6, rows - 13)} lines={lines} />
    </Box>
  );
}
