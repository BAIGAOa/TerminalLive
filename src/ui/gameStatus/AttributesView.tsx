import React from "react";
import { Box, Text } from "ink";
import Player from "../../world/Player.js";
import { StatBar, StatusScroll } from "./common.js";
import { useTerminalSize } from "../TerminalSizeContext.js";
import { barWidthFor } from "../kit/viewport.js";

export default function AttributesView({
  player,
  t,
  height,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
  height?: number;
}) {
  const { columns } = useTerminalSize();
  const barW = barWidthFor(columns);

  const lines: React.ReactNode[] = [
    <Box flexDirection="row" justifyContent="space-between">
      <Text bold color="yellow">
        {t("game.player")}: {player.playerName}
      </Text>
      <Text>
        {t("game.age")}: {Math.floor(player.age)}
      </Text>
    </Box>,
    null,
    <StatBar
      label={t("player.health")}
      value={player.health}
      color={player.health < 30 ? "red" : "green"}
      width={barW}
    />,
    <StatBar
      label={t("player.happiness")}
      value={player.happiness}
      color="magenta"
      width={barW}
    />,
    <StatBar
      label={t("player.reputation")}
      value={player.reputation}
      color="cyan"
      width={barW}
    />,
    null,
    <Text color="gray">
      {t("playerConfig.attr.height")}: {player.height}m |{" "}
      {t("playerConfig.attr.weight")}: {player.weight}kg
    </Text>,
    <Text color="yellow">
      {t("player.money")}: ${player.money}
    </Text>,
  ];

  return <StatusScroll height={height} lines={lines} />;
}
