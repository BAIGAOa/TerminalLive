import React from "react";
import { Box, Text, Newline } from "ink";
import Player from "../../world/Player.js";
import { useThemeColors } from "../../hooks/theme/ThematicCommunicator.js";

const StatusBadge = ({
  label,
  isActive,
  color,
}: {
  label: string;
  isActive: boolean;
  color: string;
}) => {
  const colors = useThemeColors();
  return (
    <Box
      borderStyle="round"
      borderColor={isActive ? color : colors.muted}
      paddingX={1}
      marginRight={1}
      marginBottom={1}
    >
      <Text color={isActive ? color : colors.muted} bold={isActive}>
        {isActive ? "●" : "○"} {label}
      </Text>
    </Box>
  );
};

export default function StatusEffectsView({
  player,
  t,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const colors = useThemeColors();

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box marginBottom={1}>
        {player.currentStatus === "none" ? (
          <Text dimColor>{t("game.status.none")}</Text>
        ) : (
          <Text color={colors.success} bold>
            {t("game.status.active")}: {t(`player.status.${player.currentStatus}`)}
          </Text>
        )}
      </Box>

      <Newline />

      <Text color={colors.muted}>--- {t("game.text.currentTrait")} ---</Text>

      <Box flexDirection="column" marginTop={1}>
        <StatusBadge label={t("player.status.anger")} isActive={player.anger} color={colors.anger} />
        <StatusBadge label={t("player.status.excitement")} isActive={player.excitement} color={colors.excitement} />
        <StatusBadge label={t("player.status.depression")} isActive={player.depression} color={colors.depression} />
        <StatusBadge label={t("player.status.weak")} isActive={player.weakness} color={colors.weakness} />
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