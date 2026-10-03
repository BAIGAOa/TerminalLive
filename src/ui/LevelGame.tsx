import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { gotoScreen, useKeyboard } from "ink-cartridge";
import useLevelGameScreen from "../hooks/useLevelGameScreen.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { container } from "../Container.js";
import AchievementManager from "../achievement/AchievementManager.js";
import { ActionPanel } from "./ActionPanel.js";
import { ScrollPanel } from "./kit/index.js";
import { ChoiceModal } from "./ChoiceModal.js";
import { GameOver } from "./GameOver.js";
import { dismissModal, presentModal } from "./layers/modalBus.js";
import useNarrative from "../hooks/useNarrative.js";
import MainMenu from "./MainMenu.js";
import ConfigStore from "../core/store/ConfigStore.js";
import { computeLifeScore } from "../game/score.js";
import { resolveKeymap } from "./keymap.js";

export default function LevelGame() {
  const data = useLevelGameScreen();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const narrative = useNarrative().join(" ");
  const endTurnKey = resolveKeymap(
    container.resolve(ConfigStore).getKeyBindings(),
  ).endTurn;

  // End the current year, and switch the status view with ← / →.
  useEffect(() => {
    const uEnd = boundKeyboard([endTurnKey], () => {
      if (data.status === "playing" && !data.pendingChoice) data.endTurn();
    });
    const uLeft = boundKeyboard(["left"], () => data.onPrevView());
    const uRight = boundKeyboard(["right"], () => data.onNextView());
    return () => {
      uEnd();
      uLeft();
      uRight();
    };
  }, [boundKeyboard, endTurnKey, data.status, data.pendingChoice, data.endTurn, data.onPrevView, data.onNextView]);

  // Choice dialog (modal layer — owns input while open).
  useEffect(() => {
    if (data.pendingChoice) {
      presentModal("choice-modal", ChoiceModal, {
        choice: data.pendingChoice,
        onResolve: data.resolveChoice,
      });
    } else {
      dismissModal("choice-modal");
    }
    return () => dismissModal("choice-modal");
  }, [data.pendingChoice, data.resolveChoice]);

  // Game-over / level-complete dialog.
  useEffect(() => {
    if (data.status === "playing") {
      dismissModal("gameover-modal");
      return;
    }
    const achievements = container
      .resolve(AchievementManager)
      .getSnapshot()
      .filter((a) => a.unlocked).length;
    const { score, rankKey } = computeLifeScore(data.player, achievements);
    presentModal("gameover-modal", GameOver, {
      info: {
        reason: data.status === "dead" ? "death" : "complete",
        age: Math.floor(data.player.age),
        playerName: data.player.playerName,
        money: data.player.money,
        achievements,
        score,
        rankKey,
        hasNext: data.status === "cleared" && data.hasNextLevel,
      },
      onNext: () => {
        dismissModal("gameover-modal");
        data.continueNextLevel();
      },
      onMenu: () => {
        dismissModal("gameover-modal");
        gotoScreen(MainMenu, {});
      },
    });
    return () => dismissModal("gameover-modal");
  }, [data.status, data.hasNextLevel]);

  const rows = Math.max(data.rows, 24);

  return (
    <Box flexDirection="column" width="100%" height={rows} padding={1}>
      {/* header */}
      <Box
        flexDirection="row"
        justifyContent="space-between"
        borderStyle="single"
        borderColor={colors.info}
        paddingX={1}
      >
        <Text bold color={colors.menuTitle}>
          {data.levelName}
        </Text>
        <Text>
          {data.t("game.age")}: <Text color="yellow">{Math.floor(data.player.age)}</Text>
          {"   "}
          {data.t("game.actions.apShort")}: <Text color="cyan">{data.actionPoints}/{data.maxActionPoints}</Text>
          {"   "}
          {data.t("player.money")}: <Text color="yellow">${data.player.money}</Text>
          {"   "}
          {data.t("player.health")}:{" "}
          <Text color={data.player.health < 30 ? "red" : "green"}>
            {Math.round(data.player.health)}
          </Text>
        </Text>
      </Box>

      <Box flexDirection="row" width="100%" flexGrow={1} marginTop={1}>
        {/* actions */}
        <Box width="34%" flexDirection="column" borderStyle="round" borderColor={colors.success} paddingX={1} marginRight={1}>
          <ActionPanel data={data} />
        </Box>

        {/* status carousel */}
        <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor={colors.info} paddingX={1}>
          <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
            <Text color={colors.muted}>{"◄ "}</Text>
            <Text bold color={colors.text}>
              {data.t(`gameVive.${data.currentViewId}`) || data.currentViewId}
            </Text>
            <Text color={colors.muted}>{" ►"}</Text>
            <Text dimColor>
              ({data.currentViewIndex + 1}/{data.viewCount})
            </Text>
          </Box>
          <Box flexDirection="column" flexGrow={1}>
            {data.renderCurrentView()}
          </Box>
          {/* victory conditions */}
          <Box flexDirection="column" marginTop={1}>
            {data.victoryConditions.map((cond, i) => (
              <Text key={i} color={cond.isMet ? colors.success : colors.muted}>
                {cond.isMet ? "  ✓" : "  ○"} {cond.description}
              </Text>
            ))}
          </Box>
        </Box>
      </Box>

      {/* journal — a prose scene, then the recent events */}
      <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} marginTop={1} height={11}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color="magenta">
            {data.t("game.journal.title", { logsLength: data.logs.length })}
          </Text>
          <Text dimColor>{data.t("game.journal.wheel")}</Text>
        </Box>
        <Box height={2} overflowY="hidden">
          <Text color={colors.text}>
            <Text dimColor>{data.t("game.scene")}: </Text>
            {narrative}
          </Text>
        </Box>
        {data.logs.length === 0 ? (
          <Text dimColor>{data.t("game.journal.noEvent")}</Text>
        ) : (
          <ScrollPanel
            height={6}
            lines={data.logs.map((entry, i) => (
              <Text key={i} color={entry.isLatest ? colors.text : colors.muted}>
                {entry.isLatest ? "▶" : " "}
                <Text color={colors.info}>{entry.timestamp}</Text>
                {" : "}
                {entry.eventName}
              </Text>
            ))}
          />
        )}
      </Box>

      <Box marginTop={1} justifyContent="center">
        <Text dimColor>
          [↑↓⏎] {data.t("game.hint.actions")}  [E] {data.t("game.hint.endTurn")}  [←→] {data.t("game.hint.view")}  [Tab] {data.t("game.hint.focus")}  [P] {data.t("console.title")}  [Q] {data.t("game.hint.menu")}
        </Text>
      </Box>
    </Box>
  );
}
