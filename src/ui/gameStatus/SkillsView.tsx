import React from "react";
import { Box, Text } from "ink";
import Player from "../../world/Player.js";
import { StatBar } from "./common.js";

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
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const avg =
    (player.intelligence + player.social + player.fitness) / 3;
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          {t("game.skills.title")}: {t(tierOf(avg))}
        </Text>
      </Box>
      <StatBar label={t("player.intelligence")} value={player.intelligence} color="cyan" width={24} />
      <StatBar label={t("player.social")} value={player.social} color="magenta" width={24} />
      <StatBar label={t("player.fitness")} value={player.fitness} color="green" width={24} />

      <Box marginTop={1}>
        <Text dimColor>
          {t("game.skills.hint")}
        </Text>
      </Box>
    </Box>
  );
}
