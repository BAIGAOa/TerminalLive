import { useState, useMemo, useCallback, useSyncExternalStore } from "react";
import { container } from "../Container.js";
import LevelManager from "../level/LevelManager.js";
import Level from "../level/Level.js";
import { useI18n } from "../core/language/LanguageContext.js";
import GeneralPurpose from "../level/conditions/GeneralPurpose.js";
import DifficultyRegistry from "../core/registry/DifficultyRegistry.js";
import LevelRecordsStore from "../core/store/LevelRecordsStore.js";
import { levelEntries } from "../level/levelProgression.js";
import type { LevelStatus } from "../level/levelProgression.js";
import LevelCondition from "../level/LevelCondition.js";

export interface DifficultyItem {
  label: string;
  value: string;
}

export type { LevelStatus };

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
  /** Status of the highlighted level (for the footer's locked hint). */
  highlightedStatus: LevelStatus | null;
  /** Extra goals on the highlighted level (some optional = medals). */
  highlightedObjectives: Array<{
    id: string;
    labelKey: string;
    optional: boolean;
    hasReward: boolean;
  }>;
  /** Medals earned / available on the highlighted level (meta record). */
  highlightedMedals: { earned: number; total: number };
  highlightedDifficulty: string | null;
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

  // Medals/progress can change after a completed run; keep the panel fresh.
  const records = container.resolve(LevelRecordsStore);
  useSyncExternalStore(records.subscribe, records.getSnapshot);

  const [activeDifficulty, setActiveDifficulty] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const leftItems: DifficultyItem[] = useMemo(() => {
    return difficultyRegistry.getDifficulties().map((d) => {
      const levels = difficultyRegistry.getLevels(d);
      const done = levels.filter((l) => levelManager.isLevelCompleted(l.id)).length;
      const base = t(`difficulty.${d}`) || d;
      return {
        label: levels.length > 0 ? `${base}  ${done}/${levels.length}` : base,
        value: d,
      };
    });
  }, [difficultyRegistry, levelManager, t, version]);

  const levelMap = useMemo(() => {
    if (!activeDifficulty) return new Map<string, Level>();
    const levels = difficultyRegistry.getLevels(activeDifficulty);
    const map = new Map<string, Level>();
    for (const l of levels) map.set(l.id, l);
    return map;
  }, [activeDifficulty, difficultyRegistry, version]);

  const rightItems: LevelItem[] = useMemo(() => {
    if (!activeDifficulty) return [];
    // Compute status on the FULL graph (cross-difficulty chains), then show the
    // active tier — otherwise a stage with an off-tier predecessor looks
    // unlocked and the chain can be skipped.
    const all = [...levelManager.getAllLevels().values()];
    const completed = new Set(
      all.filter((l) => levelManager.isLevelCompleted(l.id)).map((l) => l.id),
    );
    const statuses = new Map(
      levelEntries(all, completed).map((e) => [e.level.id, e.status]),
    );
    return Array.from(levelMap.values()).map((level) => ({
      label: t(level.nameKey) || level.nameKey,
      value: level.id,
      status: statuses.get(level.id) ?? "locked",
    }));
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

  const highlightedStatus: LevelStatus | null = highlightedId
    ? (rightItems.find((r) => r.value === highlightedId)?.status ?? null)
    : null;

  const highlightedObjectives = useMemo(
    () =>
      (highlightedLevel?.objectives ?? []).map((o) => ({
        id: o.id,
        labelKey: o.labelKey,
        optional: o.optional,
        hasReward: o.reward !== undefined,
      })),
    [highlightedLevel],
  );

  const highlightedMedals = (() => {
    if (!highlightedLevel) return { earned: 0, total: 0 };
    const rec = records.getRecord(highlightedLevel.id);
    return {
      earned: rec.medals.length,
      total: highlightedLevel.objectives.filter((o) => o.optional).length,
    };
  })();

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
    highlightedStatus,
    highlightedObjectives,
    highlightedMedals,
    highlightedDifficulty: highlightedLevel?.difficultyIdentification ?? null,
  };
}
