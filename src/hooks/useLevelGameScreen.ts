import { useSyncExternalStore, useState, useMemo, useCallback } from "react";
import { container } from "../Container.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useTerminalSize } from "../ui/TerminalSizeContext.js";
import LevelManager from "../level/LevelManager.js";
import GameStatusMap from "../core/GameStatusMap.js";
import Player from "../world/Player.js";
import LevelCondition from "../level/registry/LevelCondition.js";
import GeneralPurpose from "../level/conditions/GeneralPurpose.js";
import type { LogEntry } from "../core/store/LogStore.js";

export interface FormattedVictoryCondition {
  description: string;
  isMet: boolean;
}

export interface LogDisplayEntry {
  timestamp: string;
  eventName: string;
  isLatest: boolean;
}

export interface LevelGameData {
  player: Player;
  levelName: string;
  victoryConditions: FormattedVictoryCondition[];
  currentViewId: string;
  viewIds: string[];
  currentViewIndex: number;
  viewCount: number;
  logs: LogDisplayEntry[];
  rows: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  langCode: string;
  onPrevView: () => void;
  onNextView: () => void;
  renderCurrentView: () => React.ReactNode;
}

function formatCondition(
  condition: LevelCondition,
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

export default function useLevelGameScreen(): LevelGameData {
  const { t, langCode } = useI18n();
  const { rows } = useTerminalSize();

  const levelManager = container.resolve(LevelManager);
  const gameStatusMap = container.resolve(GameStatusMap);

  const player = levelManager.getPlayer();
  useSyncExternalStore(
    player.subscribe,
    () => `${player.age}|${player.health}|${player.angerValue}|${player.currentStatus}`,
  );

  const logStore = levelManager.getCurrentLogStore();
  const rawLogs: LogEntry[] = useSyncExternalStore(
    useCallback(
      (listener: () => void) => logStore?.subscribe(listener) ?? (() => {}),
      [logStore],
    ),
    useCallback(() => logStore?.getSnapshot() ?? [], [logStore]),
  );

  const viewIds: string[] = useMemo(() => {
    const ids: string[] = [];
    gameStatusMap.getAll().forEach((_, id) => ids.push(id));
    return ids.length > 0 ? ids : ["attributes"];
  }, [gameStatusMap]);

  const [currentViewIndex, setCurrentViewIndex] = useState(0);
  const safeIndex = viewIds.length > 0 ? Math.min(currentViewIndex, viewIds.length - 1) : 0;
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
  }, [level, player, t]);

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

  const renderCurrentView = useCallback((): React.ReactNode => {
    const renderFn = gameStatusMap.getStatus(currentViewId);
    return renderFn ? renderFn({ player, t }) : null;
  }, [gameStatusMap, currentViewId, player, t]);

  return {
    player,
    levelName,
    victoryConditions,
    currentViewId,
    viewIds,
    currentViewIndex: safeIndex,
    viewCount,
    logs,
    rows,
    t,
    langCode,
    onPrevView,
    onNextView,
    renderCurrentView,
  };
}