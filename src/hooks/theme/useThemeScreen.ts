import { useCallback, useState, useMemo } from "react";
import { Key } from "ink";
import { Theme } from "../../core/theme/ThemeDefinition.js";
import { useI18n } from "../../core/language/LanguageContext.js";
import { useTerminalSize } from "../../ui/TerminalSizeContext.js";
import { container } from "../../Container.js";
import ThemeCenter from "../../core/theme/ThemeCenter.js";
import ThemeManager from "../../core/theme/ThemeManager.js";
import ConfigStore from "../../core/store/ConfigStore.js";
export interface ThemeItem {
  label: string;
  value: string;
  theme: Theme;
  description: string;
  isCurrent: boolean;
}

export interface ThemeScreenData {
  items: ThemeItem[];
  rows: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  expandedThemeId: string | null;
  handleSelect: (item: ThemeItem) => Promise<void>;
  handleKeyPress: (input: string, key: Key, selectedIndex: number) => boolean;
  handleBack: () => void;
}

export function useThemeScreen(onBack?: () => void): ThemeScreenData {
  const { t } = useI18n();
  const { rows } = useTerminalSize();
  const [expandedThemeId, setExpandedThemeId] = useState<string | null>(null);

  const themeCenter = container.resolve(ThemeCenter);
  const themeManager = container.resolve(ThemeManager);
  const configStore = container.resolve(ConfigStore);

  const currentId = themeManager.getCurrentId();

  // themeCenter 是容器单例，不会变；但 eslint/exhaustive-deps 要求放入 deps
  const themes = useMemo(() => themeCenter.getAllTheme(), []);

  const items: ThemeItem[] = useMemo(
    () =>
      themes.map((theme) => ({
        label: t(theme.nameKey),
        value: theme.id,
        theme,
        description: theme.descriptionKey ? t(theme.descriptionKey) : "",
        isCurrent: theme.id === currentId,
      })),
    [themes, t, currentId],
  );

  const handleSelect = useCallback(
    async (item: ThemeItem) => {
      themeManager.setCurrent(item.theme.id);
      // ConfigStore 内部已做 persist，不必重复写文件
      await configStore.setTheme(item.theme.id);
    },
    [themeManager, configStore],
  );

  // D 键展开/收起当前选中主题的详细颜色；仅处理纯 'd' 字符，忽略组合键
  const handleKeyPress = useCallback(
    (input: string, key: Key, selectedIndex: number): boolean => {
      const char = input.toLowerCase();
      if (char === "d" && !key.ctrl && !key.meta && !key.shift) {
        const selectedItem = items[selectedIndex];
        if (selectedItem) {
          setExpandedThemeId((prev) =>
            prev === selectedItem.theme.id ? null : selectedItem.theme.id,
          );
          return true;
        }
      }
      return false;
    },
    [items],
  );

  const handleBack = useCallback(() => {
    onBack?.();
  }, [onBack]);

  return {
    items,
    rows,
    t,
    expandedThemeId,
    handleSelect,
    handleKeyPress,
    handleBack,
  };
}
