import React from "react";
import { Box, Text } from "ink";
import Player from "../../world/Player.js";
import { StatBar } from "./common.js";

export default function AttributesView({
  player,
  t,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Text bold color="yellow">
          {t("game.player")}: {player.playerName}
        </Text>
        <Text>
          {t("game.age")}: {Math.floor(player.age)}
        </Text>
      </Box>

      <StatBar
        label={t("player.health")}
        value={player.health}
        color={player.health < 30 ? "red" : "green"}
        width={24}
      />
      <StatBar
        label={t("player.happiness")}
        value={player.happiness}
        color="magenta"
        width={24}
      />
      <StatBar
        label={t("player.reputation")}
        value={player.reputation}
        color="cyan"
        width={24}
      />

      <Box marginTop={1} flexDirection="row">
        <Text color="gray">
          {t("playerConfig.attr.height")}: {player.height}m |{" "}
          {t("playerConfig.attr.weight")}: {player.weight}kg
        </Text>
      </Box>
      <Box flexDirection="row">
        <Text color="yellow">
          {t("player.money")}: ${player.money}
        </Text>
      </Box>
    </Box>
  );
}
