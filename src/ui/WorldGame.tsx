import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text } from "ink";
import { gotoScreen, useKeyboard } from "ink-cartridge";
import useWorldGameScreen from "../hooks/useWorldGameScreen.js";
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
import WorldSelection from "./WorldSelection.js";
import ConfigStore from "../core/store/ConfigStore.js";
import TypedEventBus from "../core/TypedEventBus.js";
import { computeLifeScore } from "../game/score.js";
import { useTerminalSize } from "./TerminalSizeContext.js";
import { resolveKeymap } from "./keymap.js";
import LineageStore from "../core/store/LineageStore.js";
import WorldState from "../world/chronicle/WorldState.js";
import {
  buildLineageRecord,
  computeInheritance,
} from "../world/lineage/inheritance.js";
import type { StatKey } from "../world/stats.js";
import type { GameOverLineage } from "./GameOver.js";
import WorldManager from "../worlds/WorldManager.js";
import WorldRecordsStore from "../core/store/WorldRecordsStore.js";

export default function WorldGame() {
  const data = useWorldGameScreen();
  const colors = useThemeColors();
  const { boundKeyboard, focusSet, focusNext } = useKeyboard();
  const narrative = useNarrative().join(" ");
  const keymap = resolveKeymap(container.resolve(ConfigStore).getKeyBindings());
  const endTurnKey = keymap.endTurn;
  const consoleKey = keymap.console.toUpperCase();
  const menuKey = keymap.menu.toUpperCase();

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
      if (data.currentViewId === "relationships") {
        try {
          focusNext("game-main");
        } catch {
          /* group not registered yet */
        }
        return;
      }
      if (data.currentViewId === "inventory") {
        safeFocus("game-actions", "game-main");
      }
    });
    return () => uTab();
  }, [boundKeyboard, data.currentViewId, focusNext, safeFocus]);

  useEffect(() => {
    if (data.currentViewId === "relationships") return;
    // The inventory list must own focus for Enter/arrow keys to work (its hint
    // promises Enter-to-use); other views hand focus back to the actions.
    if (data.currentViewId === "inventory") {
      safeFocus("inventory-list", "status-views");
      return;
    }
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

  // Records the current level's outcome once per status transition.
  const recordedRef = useRef<string | null>(null);

  // Game-over / level-complete dialog.
  useEffect(() => {
    if (data.status === "playing") {
      dismissModal("gameover-modal");
      // New attempt (e.g. a fresh life on the same level) → allow re-recording.
      recordedRef.current = null;
      return;
    }
    const achievements = container
      .resolve(AchievementManager)
      .getSnapshot()
      .filter((a) => a.unlocked).length;
    const { score, rankKey } = computeLifeScore(data.player, achievements);

    // Meta-progression: remember this attempt (completions / best / outcome).
    const levelId = container.resolve(WorldManager).getCurrentWorldId();
    const recordKey = `${data.status}:${levelId}`;
    if (levelId && recordedRef.current !== recordKey) {
      recordedRef.current = recordKey;
      const records = container.resolve(WorldRecordsStore);
      if (data.status === "cleared") {
        void records.recordCompletion(levelId, score, "complete");
        // Victory unlocks successor worlds in the tree.
        container.resolve(WorldManager).markWorldCompleted(levelId);
      } else if (data.status === "dead") {
        void records.recordCompletion(levelId, score, "death");
      }
    }

    // One world = one life: death OR victory both end the life and roll a
    // legacy into the next generation.
    const lifeOver = data.status === "dead" || data.status === "cleared";
    let lineage: GameOverLineage | undefined;
    if (lifeOver) {
      const store = container.resolve(LineageStore);
      const endedGeneration = store.getNextGeneration();
      const record = buildLineageRecord({
        player: data.player,
        karma: container.resolve(WorldState).karma,
        reason: data.status === "dead" ? "death" : "complete",
        achievements,
        generation: endedGeneration,
      });
      const plan = computeInheritance(record);
      lineage = {
        endedGeneration,
        nextGeneration: endedGeneration + 1,
        epithetKey: record.epithetKey,
        inheritedMoney: plan?.money ?? 0,
        inheritedStats: plan
          ? Object.entries(plan.deltas).map(([key, value]) => ({
              key: key as StatKey,
              value: value as number,
            }))
          : [],
      };
    }

    presentModal("gameover-modal", GameOver, {
      info: {
        reason: data.status === "dead" ? "death" : "complete",
        age: Math.floor(data.player.age),
        playerName: data.player.playerName,
        money: data.player.money,
        achievements,
        score,
        rankKey,
        hasNext: data.status === "cleared",
        lineage,
      },
      onNext: () => {
        dismissModal("gameover-modal");
        gotoScreen(WorldSelection, {});
      },
      onMenu: () => {
        dismissModal("gameover-modal");
        gotoScreen(MainMenu, {});
      },
    });
    return () => dismissModal("gameover-modal");
  }, [data.status]);

  // A finished life (death or victory) ends the auto-save slot so the next
  // launch starts a fresh life instead of resuming a corpse.
  const lifeOver = data.status === "dead" || data.status === "cleared";
  useEffect(() => {
    if (!lifeOver) return;
    container.resolve(TypedEventBus).emit("game:over", {
      reason: data.status === "dead" ? "death" : "complete",
      age: Math.floor(data.player.age),
    });
    // Clear the resume pointer too, or a fresh launch would boot into the last
    // world with default stats even though the auto-save slot was cleared.
    void container
      .resolve(ConfigStore)
      .update({ lastWorldId: undefined, lastLevelId: undefined });
  }, [lifeOver, data.status, data.player]);

  // Never assume more rows than the terminal actually has — a forced minimum
  // used to make the layout taller than the screen and spill out of the boxes.
  const rows = Math.max(1, data.rows);
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
    // Clamp stored End offset so a following PageUp moves immediately instead
    // of counting down from an absurd value.
    const end = boundKeyboard(["end"], () =>
      setJournalOffset(Math.max(0, data.logs.length - journalInner)),
    );
    return () => {
      up();
      down();
      home();
      end();
    };
  }, [boundKeyboard, data.logs.length, journalInner]);

  return (
    <Box flexDirection="column" width="100%" height={rows} padding={1}>
      {/* header */}
      <Box
        flexDirection="row"
        justifyContent="space-between"
        borderStyle="bold"
        borderColor={colors.info}
        paddingX={1}
      >
        <Text bold wrap="truncate" color={colors.menuTitle}>
          {data.levelName}
        </Text>
        <Text wrap="truncate">
          {data.t("game.age")}: <Text color={colors.warning}>{Math.floor(data.player.age)}</Text>
          {"   "}
          {data.t("game.actions.apShort")}: <Text color={colors.info}>{data.actionPoints}/{data.maxActionPoints}</Text>
          {"   "}
          {data.t("player.money")}: <Text color={colors.money}>${data.player.money}</Text>
          {"   "}
          {data.t("player.health")}:{" "}
          <Text color={data.player.health < 30 ? colors.danger : colors.health}>
            {Math.round(data.player.health)}
          </Text>
        </Text>
      </Box>

      <Box flexDirection="row" width="100%" height={middleH} marginTop={1}>
        {/* actions */}
        <Box width={actionsW} flexDirection="column" borderStyle="bold" borderColor={colors.success} paddingX={1} marginRight={1} overflowY="hidden">
          <ActionPanel data={data} height={middleH - 2} />
        </Box>

        {/* status carousel */}
        <Box flexDirection="column" flexGrow={1} borderStyle="bold" borderColor={colors.info} paddingX={1} overflowY="hidden">
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
              <Text key={i} wrap="truncate" color={cond.isMet ? colors.success : colors.muted}>
                {cond.isMet ? "  ✓" : "  ○"} {cond.description}
              </Text>
            ))}
          </Box>
        </Box>
      </Box>

      {/* journal — a prose scene, then the recent events */}
      {showJournal ? (
      <Box flexDirection="column" borderStyle="bold" borderColor={colors.info} paddingX={1} marginTop={1} height={journalH}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color={colors.info}>
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
            [PgUp/PgDn] {data.t("game.hint.journal")}   [{consoleKey}]{" "}
            {data.t("console.title")}   [{menuKey}] {data.t("game.hint.menu")}
          </Text>
        ) : null}
      </Box>
    </Box>
  );
}
