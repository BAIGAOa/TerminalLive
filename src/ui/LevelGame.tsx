import React from "react";
import { Box, Text, Newline, useInput } from "ink";
import useLevelGameScreen from "../hooks/useLevelGameScreen.js";

export default function LevelGame() {
  const data = useLevelGameScreen();

  useInput((_input, key) => {
    if (key.leftArrow) data.onPrevView();
    if (key.rightArrow) data.onNextView();
  });

  const availableRows = Math.max(data.rows, 20);

  return (
    <Box flexDirection="column" width="100%" height={availableRows} padding={1}>
      {/* 胜利条件 */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="yellow"
        paddingX={1}
        paddingY={0}
        marginBottom={1}
      >
        <Text bold color="yellow">
          {data.t("levelDetail.victoryConditions")}
          {data.levelName ? ` — ${data.levelName}` : ""}
        </Text>
        {data.victoryConditions.length === 0 ? (
          <Text dimColor>  {data.t("levelDetail.noConditions")}</Text>
        ) : (
          data.victoryConditions.map((cond, i) => (
            <Text key={i} color={cond.isMet ? "green" : "gray"}>
              {cond.isMet ? "  ✓" : "  ○"} {cond.description}
            </Text>
          ))
        )}
      </Box>

      {/* 视图切换栏 */}
      <Box
        flexDirection="row"
        borderStyle="single"
        borderColor="cyan"
        paddingX={1}
        paddingY={0}
        marginBottom={1}
        justifyContent="space-between"
      >
        <Box flexDirection="row">
          <Text color="gray">◄ </Text>
          <Text bold color="white">
            {data.t(`gameVive.${data.currentViewId}`) || data.currentViewId}
          </Text>
          <Text color="gray"> ►</Text>
          <Box marginLeft={2}>
            <Text dimColor>({data.currentViewIndex + 1}/{data.viewCount})</Text>
          </Box>
        </Box>
        <Box>
          <Text>
            {data.t("game.age")}:{" "}
            <Text color="yellow" bold>{Math.floor(data.player.age)}</Text>
          </Text>
        </Box>
      </Box>

      {/* 动态视图 */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="green"
        padding={1}
        marginBottom={1}
        flexGrow={3}
      >
        {data.renderCurrentView() ?? (
          <Box flexGrow={1} justifyContent="center" alignItems="center">
            <Text dimColor>{data.t("game.status.none")}</Text>
          </Box>
        )}
      </Box>

      {/* 事件日志 */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="magenta"
        padding={1}
        flexGrow={2}
      >
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color="magenta">
            {data.t("game.journal.title", { logsLength: data.logs.length })}
          </Text>
          {data.logs.length > 0 && (
            <Text dimColor>
              {data.t("game.age")}: {Math.floor(data.player.age)}
            </Text>
          )}
        </Box>

        <Newline />

        {data.logs.length === 0 ? (
          <Box flexGrow={1} justifyContent="center" alignItems="center">
            <Text dimColor>{data.t("game.journal.noEvent")}</Text>
          </Box>
        ) : (
          <Box flexDirection="column">
            {data.logs.slice(0, 8).map((entry, index) => (
              <Text key={index} color={entry.isLatest ? "white" : "gray"}>
                {entry.isLatest ? "▶" : " "}
                <Text color="cyan">{entry.timestamp}</Text>
                {" : "}
                {entry.eventName}
              </Text>
            ))}
            {data.logs.length > 8 && (
              <Text dimColor>
                ... +{data.logs.length - 8}
              </Text>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}