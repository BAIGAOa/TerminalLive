import { useState, useMemo, useCallback, useSyncExternalStore } from "react";
import { container } from "../Container.js";
import WorldManager from "../worlds/WorldManager.js";
import World from "../worlds/World.js";
import { useI18n } from "../core/language/LanguageContext.js";
import GeneralPurpose from "../worlds/conditions/GeneralPurpose.js";
import WorldRecordsStore from "../core/store/WorldRecordsStore.js";
import { worldEntries } from "../worlds/worldProgression.js";
import type { WorldStatus } from "../worlds/worldProgression.js";
import WorldCondition from "../worlds/WorldCondition.js";

export interface DifficultyItem {
  label: string;
  value: string;
}

export type { WorldStatus };

export interface LevelItem {
  label: string;
  value: string;
  status: WorldStatus;
}

export interface FormattedCondition {
  description: string;
  isCustom: boolean;
  raw?: Record<string, unknown>;
}

export interface WorldSelectionData {
  leftItems: DifficultyItem[];
  rightItems: LevelItem[];
  activeDifficulty: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
  onSelectDifficulty: (item: DifficultyItem) => void;
  onHighlightLevel: (item: LevelItem) => void;
  onStartLevel: (item: LevelItem) => void;
  highlightedDescKey: string | null;
  highlightedConditions: FormattedCondition[];
  highlightedStatus: WorldStatus | null;
  highlightedObjectives: Array<{
    id: string;
    labelKey: string;
    optional: boolean;
    hasReward: boolean;
  }>;
  highlightedMedals: { earned: number; total: number };
  highlightedDifficulty: string | null;
  difficultyEffects: string[];
  progressOverview: Array<{
    name: string;
    done: number;
    total: number;
    complete: boolean;
  }>;
}

function formatSingleCondition(
  condition: WorldCondition,
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

/**
 * The world-selection view-model. Worlds are grouped by theme tag (a world may
 * appear under several tags); unlock state is derived from the completed set
 * and each world's `unlockRequires` tree.
 */
export function useWorldSelection(): WorldSelectionData {
  const { t } = useI18n();
  const worldManager = container.resolve(WorldManager);

  const version = useSyncExternalStore(worldManager.subscribe, () =>
    worldManager.getSnapshot(),
  );

  const records = container.resolve(WorldRecordsStore);
  useSyncExternalStore(records.subscribe, records.getSnapshot);

  const ALL = "__all__";
  const [activeTag, setActiveTag] = useState<string | null>(ALL);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const allWorlds = useMemo(
    () => [...worldManager.getAllWorlds().values()],
    [worldManager, version],
  );

  const completed = useMemo(
    () =>
      new Set(
        allWorlds
          .filter((w) => (records.getRecord(w.id)?.completions ?? 0) > 0)
          .map((w) => w.id),
      ),
    [allWorlds, records, version],
  );

  const tagLabel = useCallback((tag: string) => t(`tag.${tag}`) || tag, [t]);

  // Progression order + status from the unlock tree (also drives the list order).
  const entries = useMemo(
    () => worldEntries(allWorlds, completed),
    [allWorlds, completed],
  );
  const orderOf = useMemo(() => {
    const m = new Map<string, number>();
    entries.forEach((e, i) => m.set(e.level.id, i));
    return m;
  }, [entries]);
  const statusOf = useMemo(
    () => new Map(entries.map((e) => [e.level.id, e.status])),
    [entries],
  );

  const tags = useMemo(() => {
    const out: string[] = [];
    for (const w of allWorlds) {
      for (const tag of w.tags) if (!out.includes(tag)) out.push(tag);
    }
    return out.length > 0 ? out : ["misc"];
  }, [allWorlds]);

  const doneCount = (worlds: World[]) =>
    worlds.filter((w) => completed.has(w.id)).length;

  // An "All worlds" group (default) lists every world in progression order, so
  // the next unlocked world is always visible — plus one group per theme tag.
  const leftItems: DifficultyItem[] = useMemo(
    () => [
      {
        label: `${t("worldSelection.all") || "All Worlds"}  ${doneCount(allWorlds)}/${allWorlds.length}`,
        value: ALL,
      },
      ...tags.map((tag) => {
        const worlds = allWorlds.filter((w) => w.tags.includes(tag));
        return {
          label: `${tagLabel(tag)}  ${doneCount(worlds)}/${worlds.length}`,
          value: tag,
        };
      }),
    ],
    [tags, allWorlds, completed, tagLabel, t],
  );

  const levelMap = useMemo(() => {
    if (!activeTag) return new Map<string, World>();
    const map = new Map<string, World>();
    for (const w of allWorlds) {
      if (activeTag === ALL || w.tags.includes(activeTag)) map.set(w.id, w);
    }
    return map;
  }, [activeTag, allWorlds, version]);

  const rightItems: LevelItem[] = useMemo(() => {
    if (!activeTag) return [];
    return [...levelMap.values()]
      .sort((a, b) => (orderOf.get(a.id) ?? 0) - (orderOf.get(b.id) ?? 0))
      .map((w) => ({
        label: `${w.icon} ${t(w.nameKey) || w.nameKey}`,
        value: w.id,
        status: statusOf.get(w.id) ?? "locked",
      }));
  }, [activeTag, levelMap, statusOf, orderOf, t]);

  const progressOverview = useMemo(
    () =>
      tags.map((tag) => {
        const worlds = allWorlds.filter((w) => w.tags.includes(tag));
        const done = worlds.filter((w) => completed.has(w.id)).length;
        return {
          name: tagLabel(tag),
          done,
          total: worlds.length,
          complete: worlds.length > 0 && done === worlds.length,
        };
      }),
    [tags, allWorlds, completed, tagLabel],
  );

  const highlightedLevel = highlightedId ? (levelMap.get(highlightedId) ?? null) : null;

  const highlightedConditions: FormattedCondition[] = useMemo(() => {
    if (!highlightedLevel) return [];
    return highlightedLevel.nextLevelUnlock.map((cond) =>
      formatSingleCondition(cond, t),
    );
  }, [highlightedLevel, t]);

  const onSelectDifficulty = useCallback((item: DifficultyItem) => {
    setActiveTag(item.value);
    setHighlightedId(null);
  }, []);

  const onHighlightLevel = useCallback((item: LevelItem) => {
    setHighlightedId(item.value);
  }, []);

  const onStartLevel = useCallback(
    (item: LevelItem) => {
      if (item.status === "locked") return;
      const world = levelMap.get(item.value);
      if (world) worldManager.start(world.id);
    },
    [levelMap, worldManager],
  );

  const highlightedStatus: WorldStatus | null = highlightedId
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
    activeDifficulty: activeTag,
    t,
    onSelectDifficulty,
    onHighlightLevel,
    onStartLevel,
    highlightedDescKey: highlightedLevel?.descriptionKey ?? null,
    highlightedConditions,
    highlightedStatus,
    highlightedObjectives,
    highlightedMedals,
    highlightedDifficulty: highlightedLevel?.tags[0] ?? activeTag,
    difficultyEffects: [],
    progressOverview,
  };
}
