import React, { useCallback, useEffect, useState } from "react";
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
import TypedEventBus from "../core/TypedEventBus.js";
import { computeLifeScore } from "../game/score.js";
import { useTerminalSize } from "./TerminalSizeContext.js";
import { resolveKeymap } from "./keymap.js";

export default function LevelGame() {
  const data = useLevelGameScreen();
  const colors = useThemeColors();
  const { boundKeyboard, focusSet, focusNext } = useKeyboard();
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

  // Focus: the action panel + the relationships cards share the "game-main"
  // group; Tab toggles between them (only on the relationships page). Leaving
  // that page always hands focus back to the actions. focusSet throws when the
  // target isn't registered (e.g. the action list is empty), so guard it.
  const safeFocus = useCallback(
    (id: string, group: string) => {
      try {
        focusSet(id, group);
      } catch {
        /* target not registered on this layer */
      }
    },
    [focusSet],
  );

  useEffect(() => {
    const uTab = boundKeyboard(["tab"], () => {
      if (data.currentViewId !== "relationships") return;
      try {
        focusNext("game-main");
      } catch {
        /* group not registered yet */
      }
    });
    return () => uTab();
  }, [boundKeyboard, data.currentViewId, focusNext]);

  useEffect(() => {
    if (data.currentViewId === "relationships") return;
    safeFocus("game-actions", "game-main");
  }, [data.currentViewId, safeFocus]);

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

  // A finished life (death, or the final stage cleared) ends the auto-save slot
  // so the next launch starts a fresh life instead of resuming a corpse.
  const lifeOver =
    data.status === "dead" || (data.status === "cleared" && !data.hasNextLevel);
  useEffect(() => {
    if (!lifeOver) return;
    container.resolve(TypedEventBus).emit("game:over", {
      reason: data.status === "dead" ? "death" : "complete",
      age: Math.floor(data.player.age),
    });
  }, [lifeOver, data.status, data.player]);

  // Never assume more rows than the terminal actually has — a forced minimum
  // used to make the layout taller than the screen and spill out of the boxes.
  const rows = Math.max(8, data.rows);
  const { columns } = useTerminalSize();

  // Deterministic, size-driven layout. The middle row (actions | status) and
  // the journal share the height left after the fixed chrome; the help text
  // shrinks from 3 lines to 2 to 1 as the terminal gets shorter.
  const HINT_H = rows >= 22 ? 3 : rows >= 16 ? 2 : 1;
  const CHROME = 2 /*padding*/ + 3 /*header*/ + 3 /*marginTops*/;
  const short = rows < 26;
  const actionsW = Math.max(18, Math.min(38, Math.floor(columns * 0.34)));

  let avail = Math.max(4, rows - CHROME - HINT_H);
  let journalH = 0;
  if (avail >= 12) {
    journalH = Math.min(9, Math.max(4, Math.round(avail * 0.3)));
  }
  const showJournal = journalH >= 4;
  const middleH = Math.max(4, avail - (showJournal ? journalH : 0));

  // Rows the status panel leaves for the active view (minus its border, the
  // carousel header row and the victory-condition lines).
  const carouselContentH = Math.max(
    3,
    middleH - 3 - data.victoryConditions.length,
  );
  const journalInner = Math.max(1, journalH - (short ? 3 : 5));

  // Journal keyboard scrolling (PageUp/PageDown/Home/End). Offset 0 = newest.
  const [journalOffset, setJournalOffset] = useState(0);
  useEffect(() => {
    const up = boundKeyboard(["pageup"], () =>
      setJournalOffset((o) => Math.max(0, o - 1)),
    );
    const down = boundKeyboard(["pagedown"], () =>
      setJournalOffset((o) => o + 1),
    );
    const home = boundKeyboard(["home"], () => setJournalOffset(0));
    const end = boundKeyboard(["end"], () => setJournalOffset(9999));
    return () => {
      up();
      down();
      home();
      end();
    };
  }, [boundKeyboard]);

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

      <Box flexDirection="row" width="100%" height={middleH} marginTop={1}>
        {/* actions */}
        <Box width={actionsW} flexDirection="column" borderStyle="round" borderColor={colors.success} paddingX={1} marginRight={1} overflowY="hidden">
          <ActionPanel data={data} height={middleH - 2} />
        </Box>

        {/* status carousel */}
        <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor={colors.info} paddingX={1}>
          <Box flexDirection="row" justifyContent="space-between" marginBottom={0}>
            <Text color={colors.muted}>{"◄ "}</Text>
            <Text bold color={colors.text}>
              {data.t(`gameVive.${data.currentViewId}`) || data.currentViewId}
            </Text>
            <Text color={colors.muted}>{" ►"}</Text>
            <Text dimColor>
              ({data.currentViewIndex + 1}/{data.viewCount})
            </Text>
          </Box>
          <Box height={carouselContentH} overflowY="hidden" flexDirection="column">
            {data.renderCurrentView(carouselContentH)}
          </Box>
          {/* victory conditions */}
          <Box flexDirection="column">
            {data.victoryConditions.map((cond, i) => (
              <Text key={i} color={cond.isMet ? colors.success : colors.muted}>
                {cond.isMet ? "  ✓" : "  ○"} {cond.description}
              </Text>
            ))}
          </Box>
        </Box>
      </Box>

      {/* journal — a prose scene, then the recent events */}
      {showJournal ? (
      <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} marginTop={1} height={journalH}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color="magenta">
            {data.t("game.journal.title", { logsLength: data.logs.length })}
          </Text>
          <Text dimColor>{data.t("game.journal.wheel")}</Text>
        </Box>
        {short ? null : (
          <Box height={2} overflowY="hidden">
            <Text color={colors.text}>
              <Text dimColor>{data.t("game.scene")}: </Text>
              {narrative}
            </Text>
          </Box>
        )}
        {data.logs.length === 0 ? (
          <Text dimColor>{data.t("game.journal.noEvent")}</Text>
        ) : (
          <ScrollPanel
            height={journalInner}
            offset={journalOffset}
            onOffsetChange={setJournalOffset}
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
      ) : null}

      <Box
        marginTop={1}
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
      >
        <Text dimColor>
          [↑↓⏎] {data.t("game.hint.actions")}   [Tab] {data.t("game.hint.focus")}
        </Text>
        {HINT_H >= 2 ? (
          <Text dimColor>
            [{endTurnKey}] {data.t("game.hint.endTurn")}   [←→]{" "}
            {data.t("game.hint.view")}
          </Text>
        ) : null}
        {HINT_H >= 3 ? (
          <Text dimColor>
            [PgUp/PgDn] {data.t("game.hint.journal")}   [P]{" "}
            {data.t("console.title")}   [Q] {data.t("game.hint.menu")}
          </Text>
        ) : null}
      </Box>
    </Box>
  );
}
