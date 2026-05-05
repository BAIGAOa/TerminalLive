import { useState, useMemo, useCallback } from "react";
import { Key } from "ink";
import { container } from "../Container.js";
import DifficultyRegistry from "../level/registry/DifficultyRegistry.js";
import LevelManager from "../level/LevelManager.js";
import Level from "../level/Level.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useSyncExternalStore } from "react";
import ConfigStore from "../core/store/ConfigStore.js";
import GeneralPurpose from "../level/conditions/GeneralPurpose.js";
import LevelCondition from "../level/registry/LevelCondition.js";
import { PlayerConfigType } from "../types/ConfigType.js";

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

export type FocusPanel = "left" | "right";

/** 格式化后的胜利条件 */
export interface FormattedCondition {
  description: string; // 人类可读的条件描述
  isCustom: boolean; // 是否为自定义条件（无法解析）
  raw?: Record<string, unknown>; // 原始数据（自定义条件用）
}

export interface LevelSelectionData {
  // --- 原有 ---
  leftItems: DifficultyItem[];
  rightItems: LevelItem[];
  focus: FocusPanel;
  activeDifficulty: string | null;
  isLeftFocused: boolean;
  isRightFocused: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  onSelectDifficulty: (item: DifficultyItem) => void;
  onSelectLevel: (item: LevelItem) => void;
  onKeyPress: (input: string, key: Key) => void;
  // 详情界面
  showDetail: boolean;
  selectedLevel: Level | null;
  formattedConditions: FormattedCondition[];
  initialAttributes: Record<string, string | number>;
  onBackFromDetail: () => void;
  onConfirmEnter: () => void;
}

/** 根据 nextLevel 链排序 */
function sortLevelsLinearly(levels: Level[]): Level[] {
  if (levels.length === 0) return [];

  const idMap = new Map<string, Level>();
  const childSet = new Set<string>();

  for (const l of levels) {
    idMap.set(l.id, l);
    if (l.nextLevel !== "none") {
      childSet.add(l.nextLevel);
    }
  }

  const root = levels.find((l) => !childSet.has(l.id));
  if (!root) {
    return [...levels].sort((a, b) => a.id.localeCompare(b.id));
  }

  const ordered: Level[] = [];
  let current: Level | undefined = root;
  while (current) {
    ordered.push(current);
    current =
      current.nextLevel === "none" ? undefined : idMap.get(current.nextLevel);
  }
  return ordered;
}

/**
 * 将 LevelCondition 格式化为人类可读的描述
 */
function formatSingleCondition(
  condition: LevelCondition,
  t: (key: string, params?: Record<string, string | number>) => string,
): FormattedCondition {
  // 处理内置的 GeneralPurpose 条件
  if (condition instanceof GeneralPurpose) {
    const propName = t(`playerConfig.attr.${condition.prop}`);
    const cmp = condition.cat === "greaterThan" ? ">" : "<";
    return {
      description: `${propName} ${cmp} ${condition.num}`,
      isCustom: false,
    };
  }

  // 未知条件类型，尝试展示类型名
  const typeName = (condition as any).constructor?.name || "Unknown";
  return {
    description: t("levelDetail.customCondition", { type: typeName }),
    isCustom: true,
  };
}

/**
 * 合并全局默认配置与关卡初始属性
 */
function mergeInitialAttributes(
  globalConfig: PlayerConfigType,
  levelInitial?: Record<string, unknown>,
): Record<string, string | number> {
  const result: Record<string, string | number> = { ...globalConfig };

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

export function useLevelSelection(onBack?: () => void): LevelSelectionData {
  const { t } = useI18n();
  const difficultyRegistry = container.resolve(DifficultyRegistry);
  const levelManager = container.resolve(LevelManager);
  const configStore = container.resolve(ConfigStore);

  const version = useSyncExternalStore(levelManager.subscribe, () =>
    levelManager.getSnapshot(),
  );

  const [focus, setFocus] = useState<FocusPanel>("left");
  const [activeDifficulty, setActiveDifficulty] = useState<string | null>(null);

  const [showDetail, setShowDetail] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);

  // 左侧难度列表
  const leftItems: DifficultyItem[] = useMemo(() => {
    return difficultyRegistry.getDifficulties().map((d) => ({
      label: t(`difficulty.${d}`) || d,
      value: d,
    }));
  }, [difficultyRegistry, t]);

  // 构建 level id → Level 的映射，供 onSelectLevel 使用
  const levelMap = useMemo(() => {
    if (!activeDifficulty) return new Map<string, Level>();
    const levels = difficultyRegistry.getLevels(activeDifficulty);
    const map = new Map<string, Level>();
    for (const l of levels) {
      map.set(l.id, l);
    }
    return map;
  }, [activeDifficulty, difficultyRegistry, version]);

  const rightItems: LevelItem[] = useMemo(() => {
    if (!activeDifficulty) return [];
    const levels = Array.from(levelMap.values());
    const sorted = sortLevelsLinearly(levels);

    let prevCompleted = true;
    const result: LevelItem[] = [];

    for (const level of sorted) {
      let status: LevelStatus;
      if (levelManager.isLevelCompleted(level.id)) {
        status = "completed";
      } else if (prevCompleted) {
        if (levelManager.determineWhetherCheckpointPassed(level)) {
          status = "completed";
        } else {
          status = "unlocked";
        }
      } else {
        status = "locked";
      }

      result.push({
        label: t(level.nameKey) || level.nameKey,
        value: level.id,
        status,
      });
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
    return mergeInitialAttributes(
      globalConfig,
      selectedLevel?.initialPlayerAttributes,
    );
  }, [selectedLevel, configStore]);

  // 焦点派生
  const isLeftFocused = focus === "left" && !showDetail;
  const isRightFocused =
    focus === "right" && rightItems.length > 0 && !showDetail;

  const onSelectDifficulty = useCallback((item: DifficultyItem) => {
    setActiveDifficulty(item.value);
    setFocus("right");
    setShowDetail(false);
    setSelectedLevel(null);
  }, []);

  const onSelectLevel = useCallback(
    (item: LevelItem) => {
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

  /** 确认进入游戏（TODO后续实现） */
  const onConfirmEnter = useCallback(() => {
    // TODO: 实现关卡开始逻辑，跳转到游戏界面
    // 后续需要在此处调用 levelManager.start(selectedLevel.id)
    // 然后通过 ScreenStore 切换到游戏场景
  }, []);

  const onKeyPress = useCallback(
    (_input: string, key: Key) => {
      if (key.escape) {
        if (showDetail) {
          onBackFromDetail();
        } else if (focus === "right") {
          setFocus("left");
        } else {
          onBack?.();
        }
      }
      // Enter 在详情模式下暂不处理（TODO）
    },
    [focus, onBack, showDetail, onBackFromDetail],
  );

  return {
    // 原有
    leftItems,
    rightItems,
    focus,
    activeDifficulty,
    isLeftFocused,
    isRightFocused,
    t,
    onSelectDifficulty,
    onSelectLevel,
    onKeyPress,
    showDetail,
    selectedLevel,
    formattedConditions,
    initialAttributes,
    onBackFromDetail,
    onConfirmEnter,
  };
}
