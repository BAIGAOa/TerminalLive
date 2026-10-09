import React from "react";
import { Text, useWindowSize } from "ink";
import Player from "../../world/Player.js";
import { StatBar, StatusScroll } from "./common.js";
import { barWidthFor } from "../kit/viewport.js";
import { averageCoreSkills, skillTier } from "../../game/skillTier.js";

export default function SkillsView({
  player,
  t,
  height,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
  height?: number;
}) {
  const avg = averageCoreSkills(player);
  const { columns } = useWindowSize();
  const barW = barWidthFor(columns);

  const lines: React.ReactNode[] = [
    <Text color="cyan" bold>
      {t("game.skills.title")}: {t(skillTier(avg))}
    </Text>,
    null,
    <StatBar label={t("player.intelligence")} value={player.intelligence} color="cyan" width={barW} />,
    <StatBar label={t("player.social")} value={player.social} color="magenta" width={barW} />,
    <StatBar label={t("player.fitness")} value={player.fitness} color="green" width={barW} />,
    null,
    <Text dimColor>{t("game.skills.hint")}</Text>,
  ];

  return <StatusScroll height={height} lines={lines} />;
}
