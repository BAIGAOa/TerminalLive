import React, { useEffect } from "react";
import { Box, Text, Newline } from "ink";
import { useKeyboard, useScreenSystem } from "@baigao_h/ink-kit";
import useLevelGameScreen from "../hooks/useLevelGameScreen.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { container } from "../Container.js";
import Game from "../core/Game.js";

export default function LevelGame() {
  const data = useLevelGameScreen();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { back } = useScreenSystem();

  // Enter 推进回合
  useEffect(() => {
    const u = boundKeyboard(["return"], () => {
      container.resolve(Game).update();
    });
    return () => u();
  }, [boundKeyboard]);

  // 左右方向键切换视图
  useEffect(() => {
    const u1 = boundKeyboard(["left"], () => {
      data.onPrevView();
    });
    const u2 = boundKeyboard(["right"], () => {
      data.onNextView();
    });
    return () => {
      u1();
      u2();
    };
  }, [data.onPrevView, data.onNextView, boundKeyboard]);

  // Escape 返回关卡选择
  useEffect(() => {
    const u = boundKeyboard(["escape"], () => {
      back();
    });
    return () => u();
  }, [back, boundKeyboard]);

  const availableRows = Math.max(data.rows, 20);

  return (
    <Box flexDirection="column" width="100%" height={availableRows} padding={1}>
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={colors.warning}
        paddingX={1}
        paddingY={0}
        marginBottom={1}
      >
        <Text bold color={colors.warning}>
          {data.t("levelDetail.victoryConditions")}
          {data.levelName ? ` — ${data.levelName}` : ""}
        </Text>
        {data.victoryConditions.length === 0 ? (
          <Text dimColor>  {data.t("levelDetail.noConditions")}</Text>
        ) : (
          data.victoryConditions.map((cond, i) => (
            <Text
              key={i}
              color={cond.isMet ? colors.success : colors.muted}
            >
              {cond.isMet ? "  ✓" : "  ○"} {cond.description}
            </Text>
          ))
        )}
      </Box>

      <Box
        flexDirection="row"
        borderStyle="single"
        borderColor={colors.info}
        paddingX={1}
        paddingY={0}
        marginBottom={1}
        justifyContent="space-between"
      >
        <Box flexDirection="row">
          <Text color={colors.muted}>{"◄ "}</Text>
          <Text bold color={colors.text}>
            {data.t(`gameVive.${data.currentViewId}`) || data.currentViewId}
          </Text>
          <Text color={colors.muted}>{" ►"}</Text>
          <Box marginLeft={2}>
            <Text dimColor>
              ({data.currentViewIndex + 1}/{data.viewCount})
            </Text>
          </Box>
        </Box>
        <Box>
          <Text>
            {data.t("game.age")}:{" "}
            <Text color={colors.warning} bold>
              {Math.floor(data.player.age)}
            </Text>
          </Text>
        </Box>
      </Box>

      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={colors.success}
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
              <Text
                key={index}
                color={entry.isLatest ? colors.text : colors.muted}
              >
                {entry.isLatest ? "▶" : " "}
                <Text color={colors.info}>{entry.timestamp}</Text>
                {" : "}
                {entry.eventName}
              </Text>
            ))}
            {data.logs.length > 8 && (
              <Text dimColor>... +{data.logs.length - 8}</Text>
            )}
          </Box>
        )}
      </Box>

      <Box marginTop={1} justifyContent="center">
        <Text dimColor>
          [Enter] {data.t("game.nextRound") || "下一回合"}  [← →] {data.t("game.switchView") || "切换视图"}  [Esc] {data.t("game.back") || "返回"}
        </Text>
      </Box>
    </Box>
  );
}