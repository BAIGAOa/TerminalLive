import { useSyncExternalStore, useCallback, useMemo, useState } from "react";
import { container } from "../Container.js";
import { AchievementCategory } from "../types/AchievementCategory.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useTerminalSize } from "../ui/TerminalSizeContext.js";
import AchievementManager from "../achievement/AchievementManager.js";

export interface CategoryMenuItem {
  label: string;
  value: AchievementCategory;
}

export interface AchievementScreenData {
  allAchievements: ReturnType<AchievementManager["getSnapshot"]>;
  filteredAchievements: ReturnType<AchievementManager["getSnapshot"]>;
  menuItems: CategoryMenuItem[];
  activeCategory: AchievementCategory;
  totalUnlocked: number;
  categoryUnlocked: number;
  rows: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  onSelectCategory: (item: CategoryMenuItem) => void;
}

export function useAchievementScreen(): AchievementScreenData {
  const { t } = useI18n();
  const manager = container.resolve(AchievementManager);
  const allAchievements = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
  );
  const { rows } = useTerminalSize();

  const [activeCategory, setActiveCategory] = useState<AchievementCategory>(
    AchievementCategory.base,
  );

  const filteredAchievements = useMemo(
    () => allAchievements.filter((a) => a.category === activeCategory),
    [allAchievements, activeCategory],
  );

  // 分类菜单
  const menuItems = useMemo(
    () =>
      Object.values(AchievementCategory).map((cat) => ({
        label: t(`achievement.category.${cat}`),
        value: cat,
      })),
    [t],
  );

  // 统计
  const totalUnlocked = useMemo(
    () => allAchievements.filter((a) => a.unlocked).length,
    [allAchievements],
  );

  const categoryUnlocked = useMemo(
    () => filteredAchievements.filter((a) => a.unlocked).length,
    [filteredAchievements],
  );

  const onSelectCategory = useCallback((item: CategoryMenuItem) => {
    setActiveCategory(item.value);
  }, []);

  return {
    allAchievements,
    filteredAchievements,
    menuItems,
    activeCategory,
    totalUnlocked,
    categoryUnlocked,
    rows,
    t,
    onSelectCategory,
  };
}
