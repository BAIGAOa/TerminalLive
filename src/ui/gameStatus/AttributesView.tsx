import React from "react";
import { Box, Text, Newline } from "ink";
import Player from "../../world/Player.js";

const ProgressBar = ({
  label,
  value,
  color,
  width = 20,
}: {
  label: string;
  value: number;
  color: string;
  width?: number;
}) => {
  const clamped = Math.max(0, Math.min(100, value));
  const filled = Math.max(0, Math.min(width, Math.floor((clamped / 100) * width)));
  const empty = Math.max(0, width - filled);
  return (
    <Box flexDirection="row">
      <Box width={14}>
        <Text>{label}: </Text>
      </Box>
      <Text color={color}>
        {"█".repeat(filled)}
        <Text color="gray">{"░".repeat(empty)}</Text>
      </Text>
      <Text> {Math.round(clamped)}%</Text>
    </Box>
  );
};

export default function AttributesView({
  player,
  t,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Text bold color="yellow">
          {t("game.player")}: {player.playerName}
        </Text>
        <Text>
          {t("game.age")}: {Math.floor(player.age)}
        </Text>
      </Box>

      <Newline />

      <ProgressBar
        label={t("player.health")}
        value={player.health}
        color={player.health < 30 ? "red" : "green"}
        width={30}
      />

      <Newline />

      <Box flexDirection="row" marginBottom={1}>
        <Text color="gray">
          {t("playerConfig.attr.height")}: {player.height}m |{" "}
          {t("playerConfig.attr.weight")}: {player.weight}kg
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray">--- {t("game.text.psychologicalIndex")} ---</Text>
        <ProgressBar label={t("player.anger")} value={player.angerValue} color="red" />
        <ProgressBar label={t("player.excitement")} value={player.excitationValue} color="yellow" />
        <ProgressBar label={t("player.depression")} value={player.depressionValue} color="blue" />
        <ProgressBar label={t("player.weak")} value={player.weakValue} color="white" />
      </Box>

      <Box flexDirection="row">
        <Text color="yellow">
          {t("player.money")}: {player.fortune}
        </Text>
      </Box>
    </Box>
  );
}