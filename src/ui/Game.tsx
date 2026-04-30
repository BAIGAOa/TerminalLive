import React from 'react';
import { Box, Text, Newline } from 'ink';
import Player from '../world/Player.js';
import { useGameScreen } from '../hooks/useGameScreen.js';
import { GameViveModes } from '../types/GameViveModeType.js';


const ProgressBar = ({
  label, value, color, width = 20,
}: {
  label: string; value: number; color: string; width?: number;
}) => {
  const filledWidth = Math.max(0, Math.min(width, Math.floor((value / 100) * width)));
  const emptyWidth = Math.max(0, width - filledWidth);
  return (
    <Box flexDirection="row">
      <Box width={12}><Text>{label}: </Text></Box>
      <Text color={color}>
        {'█'.repeat(filledWidth)}
        <Text color="gray">{'░'.repeat(emptyWidth)}</Text>
      </Text>
      <Text> {Math.round(value)}%</Text>
    </Box>
  );
};

const StatusBadge = ({
  label, isActive, color,
}: {
  label: string; isActive: boolean; color: string;
}) => (
  <Box borderStyle="round" borderColor={isActive ? color : 'gray'} paddingX={1} marginRight={1}>
    <Text color={isActive ? color : 'gray'} bold={isActive}>
      {isActive ? '●' : '○'} {label}
    </Text>
  </Box>
);

const AttributesPanel = ({
  player, t,
}: {
  player: Player; t: (key: string, params?: Record<string, string | number>) => string;
}) => (
  <>
    <Newline />
    <ProgressBar label={t("player.health")} value={player.health}
      color={player.health < 30 ? "red" : "green"} width={30} />
    <Newline />
    <Box flexDirection="column">
      <Text color="gray">--- {t("game.text.psychologicalIndex")} ---</Text>
      <ProgressBar label={t("player.anger")} value={player.angerValue} color="red" />
      <ProgressBar label={t("player.excitement")} value={player.excitationValue} color="yellow" />
      <ProgressBar label={t("player.depression")} value={player.depressionValue} color="blue" />
      <ProgressBar label={t("player.weak")} value={player.weakValue} color="white" />
    </Box>
    <Box flexDirection="row" marginTop={1}>
      <Text color="yellow">{t("player.money")} {player.fortune}</Text>
    </Box>
  </>
);

const StatusPanel = ({
  player, t,
}: {
  player: Player; t: (key: string, params?: Record<string, string | number>) => string;
}) => (
  <>
    <Newline />
    <Text color="gray">--- {t("game.text.currentTrait")} ---</Text>
    <Box flexDirection="column" marginTop={1}>
      <StatusBadge label={t("player.status.anger")} isActive={player.anger} color="red" />
      <StatusBadge label={t("player.status.excitement")} isActive={player.excitement} color="yellow" />
      <StatusBadge label={t("player.status.depression")} isActive={player.depression} color="blue" />
      <StatusBadge label={t("player.status.weak")} isActive={player.weakness} color="white" />
    </Box>
    <Box marginTop={1}>
      {player.currentStatus === "none" ? (
        <Text dimColor>{t("game.status.none")}</Text>
      ) : (
        <Text color="green" bold>
          {t("game.status.active")}: {t(`player.status.${player.currentStatus}`)}
        </Text>
      )}
    </Box>
  </>
);


export const PlayerDashboard = ({ player }: { player: Player }) => {
  const data = useGameScreen(player);

  return (
    <Box flexDirection="column" width="100%" height={data.rows}>
      {/* 视图切换栏 */}
      <Box flexDirection="row" width="100%" borderStyle="bold" padding={1}>
        {data.viewModes.map(mode => (
          <StatusBadge
            key={mode}
            label={data.t(`gameVive.${mode}`)}
            isActive={data.viewMode === mode}
            color="green"
          />
        ))}
      </Box>

      {/* 可切换面板 */}
      <Box flexDirection="column" padding={1} borderStyle="single" borderColor="cyan" width="100%">
        <Box justifyContent="space-between">
          <Text bold color="yellow">{data.t("game.player")}: {data.player.playerName}</Text>
          <Text>{data.t("game.age")}: {Math.floor(data.player.age)}</Text>
        </Box>
        {data.viewMode === GameViveModes.attributes
          ? <AttributesPanel player={data.player} t={data.t} />
          : <StatusPanel player={data.player} t={data.t} />
        }
      </Box>

      {/* 日志区 */}
      <Box flexDirection="column" padding={1} borderStyle="single" borderColor="yellow"
        flexGrow={1} marginLeft={1}>
        <Text bold color="yellow">
          {data.t("game.journal.title", { logsLength: data.logs.length })}
        </Text>
        <Newline />
        {data.logs.map((entry, index) => (
          <Text key={index} color={index === 0 ? "white" : "gray"}>
            {index === 0 ? "▶" : " "}
            {entry.timestamp.toLocaleString(data.langCode.replace("_", "-"))}
            : {data.t(entry.incident.nameKey ?? entry.incident.id)}
          </Text>
        ))}
        {data.logs.length === 0 && <Text color="gray">{data.t("game.journal.noEvent")}</Text>}
      </Box>
    </Box>
  );
};