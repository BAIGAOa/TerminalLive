import React, { useSyncExternalStore, useState, useMemo, useCallback, useEffect } from "react";
import { Text } from "ink";
import { container } from "../Container.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useWindowSize } from "ink";
import WorldManager from "../worlds/WorldManager.js";
import Player from "../world/Player.js";
import type { LogEntry } from "../core/store/LogStore.js";
import GameStatusMap from "../core/registry/GameStatusMap.js";
import Game, { ActionView, GameStatusKind } from "../core/Game.js";
import { PendingChoice } from "../event/PendingChoice.js";
import { describeCondition } from "../world/conditionText.js";
import { formatLogEntries, type LogDisplayEntry } from "../ui/logFormat.js";
import { relationshipDigest } from "../ui/playerSnapshot.js";
import { ChoiceModal } from "../ui/ChoiceModal.js";
import { dismissModal, presentModal } from "../ui/layers/modalBus.js";

export type { LogDisplayEntry } from "../ui/logFormat.js";

// Stable fallbacks for useSyncExternalStore when no level is active.
const NOOP_SUB = () => () => {};
const EMPTY_LOGS: never[] = [];

export interface FormattedVictoryCondition {
  description: string;
  isMet: boolean;
}

export interface GameScreenData {
  player: Player;
  levelName: string;
  victoryConditions: FormattedVictoryCondition[];
  viewIds: string[];
  currentViewId: string;
  currentViewIndex: number;
  viewCount: number;
  actionViews: ActionView[];
  actionPoints: number;
  maxActionPoints: number;
  status: GameStatusKind;
  pendingChoice: PendingChoice | null;
  logs: LogDisplayEntry[];
  rows: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  langCode: string;
  onPrevView: () => void;
  onNextView: () => void;
  performAction: (id: string) => void;
  endTurn: () => void;
  resolveChoice: (id: string) => void;
  /** Render the active status view, told how many rows it may occupy. */
  renderCurrentView: (height: number) => React.ReactNode;
}

export default function useWorldGameScreen(): GameScreenData {
  const { t, langCode } = useI18n();
  const { rows } = useWindowSize();

  const levelManager = container.resolve(WorldManager);
  const game = container.resolve(Game);
  const gameStatusMap = container.resolve(GameStatusMap);

  const player = levelManager.getPlayer();

  // Re-render on any player change relevant to the screen. The relationship
  // digest (id:value pairs, not just the size) matters: an NPC-gated action and
  // the affinity bar only update when an individual affinity crosses a
  // threshold, which leaves `.size` unchanged.
  useSyncExternalStore(
    player.subscribe,
    () =>
      [
        player.age,
        player.health,
        player.happiness,
        player.money,
        player.reputation,
        player.actionPoints,
        player.intelligence,
        player.social,
        player.fitness,
        player.activeEffects.length,
        player.inventory.length,
        player.flags.size,
        relationshipDigest(player.relationships),
      ].join("|"),
  );

  // Re-render on level state changes (turn, choices).
  useSyncExternalStore(levelManager.subscribe, levelManager.getSnapshot);

  const logStore = levelManager.getCurrentLogStore();
  const rawLogs: LogEntry[] = useSyncExternalStore(
    useCallback(
      (listener: () => void) => logStore?.subscribe(listener) ?? NOOP_SUB,
      [logStore],
    ),
    useCallback(() => logStore?.getSnapshot() ?? EMPTY_LOGS, [logStore]),
  );

  const viewIds: string[] = useMemo(() => {
    const ids: string[] = [];
    gameStatusMap.getMap().forEach((_, id) => ids.push(id));
    // No panels installed (the status-views plugin is off): an empty list is
    // the truth. Naming a panel here would only make the render below throw.
    return ids;
  }, [gameStatusMap]);

  const [currentViewIndex, setCurrentViewIndex] = useState(0);
  const safeIndex =
    viewIds.length > 0 ? Math.min(currentViewIndex, viewIds.length - 1) : 0;
  const currentViewId = viewIds[safeIndex] ?? "";
  const viewCount = viewIds.length;

  const level = (() => {
    try {
      return levelManager.current;
    } catch {
      return null;
    }
  })();

  const levelName = useMemo(() => (level ? t(level.nameKey) : ""), [level, t]);

  const victoryConditions: FormattedVictoryCondition[] = useMemo(() => {
    if (!level?.nextLevelUnlock) return [];
    return level.nextLevelUnlock.map((cond) => {
      const described = describeCondition(cond, t);
      return {
        description: described.known ? described.description : `[${described.typeName}]`,
        isMet: cond.customsClearance(player),
      };
    });
  }, [
    level,
    player,
    t,
    player.age,
    player.health,
    player.money,
    player.reputation,
    player.intelligence,
    player.social,
    player.fitness,
    player.happiness,
  ]);

  const logs: LogDisplayEntry[] = useMemo(
    () => formatLogEntries(rawLogs, langCode, t),
    [rawLogs, langCode, t],
  );

  const onPrevView = useCallback(() => {
    setCurrentViewIndex((prev) => (prev - 1 + viewCount) % viewCount);
  }, [viewCount]);

  const onNextView = useCallback(() => {
    setCurrentViewIndex((prev) => (prev + 1) % viewCount);
  }, [viewCount]);

  const renderCurrentView = useCallback(
    (height: number): React.ReactNode => {
      // `tryGet`, not `get`: the panels are registered by a plugin now, so a
      // player who switches that plugin off leaves this registry empty — and a
      // throw here lands in the middle of the game screen's render.
      const renderFn = gameStatusMap.tryGet(currentViewId);
      if (!renderFn) {
        return React.createElement(
          Text,
          { dimColor: true },
          t("game.status.none"),
        );
      }
      return renderFn({ player, t, height });
    },
    [gameStatusMap, currentViewId, player, t],
  );

  // Stable callbacks — keeping these referentially stable stops effects that
  // depend on them (e.g. the modal-opening effect in WorldGame) from re-running
  // on every render, which would otherwise re-apply layer elements in a loop.
  const performActionStable = useCallback(
    (id: string) => {
      game.performAction(id);
    },
    [game],
  );
  const endTurnStable = useCallback(() => {
    game.endTurn();
  }, [game]);
  const resolveChoiceStable = useCallback(
    (id: string) => {
      game.resolveChoice(id);
    },
    [game],
  );
  const actionViews = useMemo(
    () => game.getActionViews(),
    [
      game,
      player.age,
      player.actionPoints,
      player.money,
      player.intelligence,
      player.social,
      player.fitness,
      player.reputation,
      player.flags.size,
      // Map identity changes on adjustRelationship, so NPC-gated actions refresh.
      player.relationships,
    ],
  );

  const status = game.getStatus();
  const pendingChoice = game.getPendingChoice();

  // Offer the choice dialog from here, not from the screen.
  //
  // It is a modal *layer*: it belongs to the game (an event is waiting on the
  // player), not to the layout that happens to be on screen. A plugin that
  // replaces the in-game screen would otherwise strand the player at a choice
  // with nothing to answer.
  useEffect(() => {
    if (pendingChoice) {
      presentModal("choice-modal", ChoiceModal, {
        choice: pendingChoice,
        onResolve: resolveChoiceStable,
      });
    } else {
      dismissModal("choice-modal");
    }
    return () => dismissModal("choice-modal");
  }, [pendingChoice, resolveChoiceStable]);

  return {
    player,
    levelName,
    victoryConditions,
    viewIds,
    currentViewId,
    currentViewIndex: safeIndex,
    viewCount,
    actionViews,
    actionPoints: player.actionPoints,
    maxActionPoints: player.maxActionPoints(),
    status,
    pendingChoice,
    logs,
    rows,
    t,
    langCode,
    onPrevView,
    onNextView,
    performAction: performActionStable,
    endTurn: endTurnStable,
    resolveChoice: resolveChoiceStable,
    renderCurrentView,
  };
}
