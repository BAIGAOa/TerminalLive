import React from "react";
import { Box, Text, Newline } from "ink";
import Player from "../../world/Player.js";

const StatusBadge = ({
  label,
  isActive,
  color,
}: {
  label: string;
  isActive: boolean;
  color: string;
}) => (
  <Box
    borderStyle="round"
    borderColor={isActive ? color : "gray"}
    paddingX={1}
    marginRight={1}
    marginBottom={1}
  >
    <Text color={isActive ? color : "gray"} bold={isActive}>
      {isActive ? "●" : "○"} {label}
    </Text>
  </Box>
);

export default function StatusEffectsView({
  player,
  t,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box marginBottom={1}>
        {player.currentStatus === "none" ? (
          <Text dimColor>{t("game.status.none")}</Text>
        ) : (
          <Text color="green" bold>
            {t("game.status.active")}: {t(`player.status.${player.currentStatus}`)}
          </Text>
        )}
      </Box>

      <Newline />

      <Text color="gray">--- {t("game.text.currentTrait")} ---</Text>

      <Box flexDirection="column" marginTop={1}>
        <StatusBadge label={t("player.status.anger")} isActive={player.anger} color="red" />
        <StatusBadge label={t("player.status.excitement")} isActive={player.excitement} color="yellow" />
        <StatusBadge label={t("player.status.depression")} isActive={player.depression} color="blue" />
        <StatusBadge label={t("player.status.weak")} isActive={player.weakness} color="white" />
      </Box>

      <Newline />

      <Box flexDirection="column">
        <Text dimColor>
          {t("player.anger")}: {Math.round(player.angerValue)}% |{" "}
          {t("player.excitement")}: {Math.round(player.excitationValue)}%
        </Text>
        <Text dimColor>
          {t("player.depression")}: {Math.round(player.depressionValue)}% |{" "}
          {t("player.weak")}: {Math.round(player.weakValue)}%
        </Text>
      </Box>
    </Box>
  );
}