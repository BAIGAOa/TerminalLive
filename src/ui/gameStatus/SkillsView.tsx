import React from "react";
import { Text } from "ink";
import Player from "../../world/Player.js";
import { StatBar, StatusScroll } from "./common.js";
import { useTerminalSize } from "../TerminalSizeContext.js";

function tierOf(avg: number): string {
  if (avg >= 90) return "skillTier.legend";
  if (avg >= 75) return "skillTier.expert";
  if (avg >= 55) return "skillTier.adept";
  if (avg >= 35) return "skillTier.learner";
  return "skillTier.novice";
}

export default function SkillsView({
  player,
  t,
  height,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
  height?: number;
}) {
  const avg =
    (player.intelligence + player.social + player.fitness) / 3;
  const { columns } = useTerminalSize();
  const barW = Math.max(8, Math.min(20, Math.floor(columns * 0.22)));

  const lines: React.ReactNode[] = [
    <Text color="cyan" bold>
      {t("game.skills.title")}: {t(tierOf(avg))}
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
