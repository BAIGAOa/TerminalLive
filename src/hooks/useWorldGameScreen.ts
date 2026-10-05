import { useSyncExternalStore, useState, useMemo, useCallback } from "react";
import { container } from "../Container.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useTerminalSize } from "../ui/TerminalSizeContext.js";
import WorldManager from "../worlds/WorldManager.js";
import Player from "../world/Player.js";
import GeneralPurpose from "../worlds/conditions/GeneralPurpose.js";
import type { LogEntry } from "../core/store/LogStore.js";
import WorldCondition from "../worlds/WorldCondition.js";
import GameStatusMap from "../core/registry/GameStatusMap.js";
import Game, { ActionView, GameStatusKind } from "../core/Game.js";
import { PendingChoice } from "../event/PendingChoice.js";

// Stable fallbacks for useSyncExternalStore when no level is active.
const NOOP_SUB = () => () => {};
const EMPTY_LOGS: never[] = [];

export interface FormattedVictoryCondition {
  description: string;
  isMet: boolean;
}

export interface LogDisplayEntry {
  timestamp: string;
  eventName: string;
  isLatest: boolean;
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

function formatCondition(
  condition: WorldCondition,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (condition instanceof GeneralPurpose) {
    const propName = t(`playerConfig.attr.${condition.prop}`);
    const cmp = condition.cat === "greaterThan" ? ">" : "<";
    return `${propName} ${cmp} ${condition.num}`;
  }
  const typeName = (condition as any).constructor?.name || "Unknown";
  return `[${typeName}]`;
}

export default function useWorldGameScreen(): GameScreenData {
  const { t, langCode } = useI18n();
  const { rows } = useTerminalSize();

  const levelManager = container.resolve(WorldManager);
  const game = container.resolve(Game);
  const gameStatusMap = container.resolve(GameStatusMap);

  const player = levelManager.getPlayer();

  // Re-render on any player change relevant to the screen.
  useSyncExternalStore(
    player.subscribe,
    () =>
      [
        player.age,
        player.health,
        player.happiness,
        player.money,
        player.actionPoints,
        player.intelligence,
        player.social,
        player.fitness,
        player.activeEffects.length,
        player.inventory.length,
        player.relationships.size,
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
    return ids.length > 0 ? ids : ["attributes"];
  }, [gameStatusMap]);

  const [currentViewIndex, setCurrentViewIndex] = useState(0);
  const safeIndex =
    viewIds.length > 0 ? Math.min(currentViewIndex, viewIds.length - 1) : 0;
  const currentViewId = viewIds[safeIndex] ?? "attributes";
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
    return level.nextLevelUnlock.map((cond) => ({
      description: formatCondition(cond, t),
      isMet: cond.customsClearance(player),
    }));
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

  const logs: LogDisplayEntry[] = useMemo(() => {
    if (!rawLogs?.length) return [];
    const locale = langCode.replace("_", "-");
    return rawLogs.map((entry, index) => ({
      timestamp: entry.timestamp.toLocaleString(locale),
      eventName: t(entry.incident.nameKey ?? entry.incident.id),
      isLatest: index === 0,
    }));
  }, [rawLogs, langCode, t]);

  const onPrevView = useCallback(() => {
    setCurrentViewIndex((prev) => (prev - 1 + viewCount) % viewCount);
  }, [viewCount]);

  const onNextView = useCallback(() => {
    setCurrentViewIndex((prev) => (prev + 1) % viewCount);
  }, [viewCount]);

  const renderCurrentView = useCallback(
    (height: number): React.ReactNode => {
      const renderFn = gameStatusMap.get(currentViewId);
      return renderFn ? renderFn({ player, t, height }) : null;
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
