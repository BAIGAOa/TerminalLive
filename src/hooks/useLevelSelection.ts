import { useState, useMemo, useCallback, useSyncExternalStore } from "react";
import { container } from "../Container.js";
import LevelManager from "../level/LevelManager.js";
import Level from "../level/Level.js";
import { useI18n } from "../core/language/LanguageContext.js";
import ConfigStore from "../core/store/ConfigStore.js";
import GeneralPurpose from "../level/conditions/GeneralPurpose.js";
import { PlayerConfigType } from "../types/ConfigType.js";
import DifficultyRegistry from "../core/registry/DifficultyRegistry.js";
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
  onSelectLevel: (item: LevelItem) => void;
  showDetail: boolean;
  selectedLevel: Level | null;
  formattedConditions: FormattedCondition[];
  initialAttributes: Record<string, string | number>;
  onBackFromDetail: () => void;
  onConfirmEnter: () => void;
}

function sortLevelsLinearly(levels: Level[]): Level[] {
  if (levels.length === 0) return [];
  const idMap = new Map<string, Level>();
  const childSet = new Set<string>();
  for (const l of levels) {
    idMap.set(l.id, l);
    if (l.nextLevel !== "none") childSet.add(l.nextLevel);
  }
  const root = levels.find((l) => !childSet.has(l.id));
  if (!root) return [...levels].sort((a, b) => a.id.localeCompare(b.id));
  const ordered: Level[] = [];
  const seen = new Set<string>();
  let current: Level | undefined = root;
  // `seen` guards against a cyclic nextLevel chain (e.g. a bad mod).
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    ordered.push(current);
    current = current.nextLevel === "none" ? undefined : idMap.get(current.nextLevel);
  }
  return ordered;
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

function mergeInitialAttributes(
  globalConfig: PlayerConfigType,
  levelInitial?: Record<string, unknown>,
): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(globalConfig)) {
    if (typeof value === "string" || typeof value === "number") {
      result[key] = value;
    }
  }
  if (levelInitial) {
    for (const [key, value] of Object.entries(levelInitial)) {
      if (
        key in result &&
        (typeof value === "string" || typeof value === "number")
      ) {
        result[key] = value;
      }
    }
  }
  return result;
}

export function useLevelSelection(): LevelSelectionData {
  const { t } = useI18n();
  const difficultyRegistry = container.resolve(DifficultyRegistry);
  const levelManager = container.resolve(LevelManager);
  const configStore = container.resolve(ConfigStore);

  const version = useSyncExternalStore(levelManager.subscribe, () =>
    levelManager.getSnapshot(),
  );

  const [activeDifficulty, setActiveDifficulty] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);

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

  const formattedConditions: FormattedCondition[] = useMemo(() => {
    if (!selectedLevel) return [];
    return selectedLevel.nextLevelUnlock.map((cond) =>
      formatSingleCondition(cond, t),
    );
  }, [selectedLevel, t]);

  const initialAttributes: Record<string, string | number> = useMemo(() => {
    const globalConfig = configStore.getPlayerConfig();
    return mergeInitialAttributes(globalConfig, selectedLevel?.initialPlayerAttributes);
  }, [selectedLevel, configStore]);

  const onSelectDifficulty = useCallback((item: DifficultyItem) => {
    setActiveDifficulty(item.value);
    setShowDetail(false);
    setSelectedLevel(null);
  }, []);

  const onSelectLevel = useCallback(
    (item: LevelItem) => {
      if (item.status === "locked") return; // locked levels cannot be started
      const level = levelMap.get(item.value);
      if (level) {
        setSelectedLevel(level);
        setShowDetail(true);
      }
    },
    [levelMap],
  );

  const onBackFromDetail = useCallback(() => {
    setShowDetail(false);
    setSelectedLevel(null);
  }, []);

  const onConfirmEnter = useCallback(() => {
    if (!selectedLevel) return;
    levelManager.start(selectedLevel.id);
  }, [selectedLevel, levelManager]);

  return {
    leftItems,
    rightItems,
    activeDifficulty,
    t,
    onSelectDifficulty,
    onSelectLevel,
    showDetail,
    selectedLevel,
    formattedConditions,
    initialAttributes,
    onBackFromDetail,
    onConfirmEnter,
  };
}
