import React from "react";
import { Text } from "ink";
import Player from "../../world/Player.js";
import { container } from "../../Container.js";
import HealthSystem from "../../world/health/HealthSystem.js";
import { bar, StatusScroll } from "./common.js";

/** Body & mind: chronic conditions, trauma/resilience/meaning, addictions. */
export default function HealthView({
  player,
  t,
  height,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
  height?: number;
}) {
  const health = container.resolve(HealthSystem);
  const state = health.getState();

  const conditions = Object.entries(state.conditions);
  const addictions = Object.entries(state.addictions);

  const lines: React.ReactNode[] = [
    <Text color="cyan" bold>
      {t("health.title")}
    </Text>,
    <Text dimColor>
      {t("health.wellbeing")}: {health.wellbeing()}
      {"   "}
      {t("health.expectancy")}: {health.lifeExpectancy(player)}
    </Text>,
    null,
    <Text>
      {t("health.trauma")}{" "}
      <Text color={state.trauma > 50 ? "red" : "gray"}>{bar(state.trauma, 12)}</Text>
    </Text>,
    <Text>
      {t("health.resilience")}{" "}
      <Text color="green">{bar(state.resilience, 12)}</Text>
    </Text>,
    <Text>
      {t("health.meaning")}{" "}
      <Text color={state.meaning < 25 ? "red" : "cyan"}>{bar(state.meaning, 12)}</Text>
    </Text>,
    null,
    <Text dimColor>── {t("health.conditions")} ──</Text>,
  ];

  if (conditions.length === 0) {
    lines.push(<Text dimColor>{t("health.none")}</Text>);
  } else {
    for (const [id, c] of conditions) {
      lines.push(
        <Text key={id} color={c.severity > 60 ? "red" : "yellow"}>
          {t(`cond.${id}`)} {bar(c.severity, 10)} {Math.round(c.severity)}
        </Text>,
      );
    }
  }

  if (addictions.length > 0) {
    lines.push(null, <Text dimColor>── {t("health.addictions")} ──</Text>);
    for (const [id, a] of addictions) {
      lines.push(
        <Text key={id} color="magenta">
          {t(`add.${id}`)} {bar(a.dependence, 10)} {Math.round(a.dependence)}
        </Text>,
      );
    }
  }

  return <StatusScroll height={height} lines={lines} />;
}
