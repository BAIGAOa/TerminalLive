import { useState, useMemo, useCallback, useSyncExternalStore } from "react";
import { container } from "../Container.js";
import LevelManager from "../level/LevelManager.js";
import Level from "../level/Level.js";
import { useI18n } from "../core/language/LanguageContext.js";
import GeneralPurpose from "../level/conditions/GeneralPurpose.js";
import DifficultyRegistry from "../core/registry/DifficultyRegistry.js";
import { sortLevelsLinearly } from "../level/levelChain.js";
import LevelCondition from "../level/LevelCondition.js";

export interface DifficultyItem {
  label: string;
  value: string;
}

export type LevelStatus = "locked" | "unlocked" | "completed";

export interface LevelItem {
  label: string;
  value: string;
  status: LevelStatus;
}

export interface FormattedCondition {
  description: string;
  isCustom: boolean;
  raw?: Record<string, unknown>;
}

export interface LevelSelectionData {
  leftItems: DifficultyItem[];
  rightItems: LevelItem[];
  activeDifficulty: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
  onSelectDifficulty: (item: DifficultyItem) => void;
  /** Previews a level's conditions in the footer (no navigation). */
  onHighlightLevel: (item: LevelItem) => void;
  /** Starts the highlighted level directly (one Enter). */
  onStartLevel: (item: LevelItem) => void;
  /** Description key of the currently highlighted level, if any. */
  highlightedDescKey: string | null;
  highlightedConditions: FormattedCondition[];
}

function formatSingleCondition(
  condition: LevelCondition,
  t: (key: string, params?: Record<string, string | number>) => string,
): FormattedCondition {
  if (condition instanceof GeneralPurpose) {
    const propName = t(`playerConfig.attr.${condition.prop}`);
    const cmp = condition.cat === "greaterThan" ? ">" : "<";
    return { description: `${propName} ${cmp} ${condition.num}`, isCustom: false };
  }
  const typeName = (condition as any).constructor?.name || "Unknown";
  return {
    description: t("levelDetail.customCondition", { type: typeName }),
    isCustom: true,
  };
}

export function useLevelSelection(): LevelSelectionData {
  const { t } = useI18n();
  const difficultyRegistry = container.resolve(DifficultyRegistry);
  const levelManager = container.resolve(LevelManager);

  const version = useSyncExternalStore(levelManager.subscribe, () =>
    levelManager.getSnapshot(),
  );

  const [activeDifficulty, setActiveDifficulty] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const leftItems: DifficultyItem[] = useMemo(() => {
    return difficultyRegistry.getDifficulties().map((d) => ({
      label: t(`difficulty.${d}`) || d,
      value: d,
    }));
  }, [difficultyRegistry, t]);

  const levelMap = useMemo(() => {
    if (!activeDifficulty) return new Map<string, Level>();
    const levels = difficultyRegistry.getLevels(activeDifficulty);
    const map = new Map<string, Level>();
    for (const l of levels) map.set(l.id, l);
    return map;
  }, [activeDifficulty, difficultyRegistry, version]);

  const rightItems: LevelItem[] = useMemo(() => {
    if (!activeDifficulty) return [];
    const levels = Array.from(levelMap.values());
    const sorted = sortLevelsLinearly(levels);

    // Chain progression: a level is unlocked only when the previous one in the
    // chain is completed; everything after the first incomplete level is locked.
    let prevCompleted = true;
    const result: LevelItem[] = [];
    for (const level of sorted) {
      const completed = levelManager.isLevelCompleted(level.id);
      let status: LevelStatus;
      if (completed) status = "completed";
      else if (prevCompleted) status = "unlocked";
      else status = "locked";
      result.push({
        label: t(level.nameKey) || level.nameKey,
        value: level.id,
        status,
      });
      prevCompleted = completed;
    }
    return result;
  }, [activeDifficulty, levelMap, levelManager, t, version]);

  const highlightedLevel = highlightedId ? (levelMap.get(highlightedId) ?? null) : null;

  const highlightedConditions: FormattedCondition[] = useMemo(() => {
    if (!highlightedLevel) return [];
    return highlightedLevel.nextLevelUnlock.map((cond) =>
      formatSingleCondition(cond, t),
    );
  }, [highlightedLevel, t]);

  const onSelectDifficulty = useCallback((item: DifficultyItem) => {
    setActiveDifficulty(item.value);
    setHighlightedId(null);
  }, []);

  const onHighlightLevel = useCallback((item: LevelItem) => {
    setHighlightedId(item.value);
  }, []);

  const onStartLevel = useCallback(
    (item: LevelItem) => {
      if (item.status === "locked") return; // locked levels cannot be started
      const level = levelMap.get(item.value);
      if (level) levelManager.start(level.id);
    },
    [levelMap, levelManager],
  );

  return {
    leftItems,
    rightItems,
    activeDifficulty,
    t,
    onSelectDifficulty,
    onHighlightLevel,
    onStartLevel,
    highlightedDescKey: highlightedLevel?.descriptionKey ?? null,
    highlightedConditions,
  };
}
