import { useCallback, useMemo } from "react";
import { Theme } from "../../core/theme/ThemeDefinition.js";
import { useI18n } from "../../core/language/LanguageContext.js";
import { useWindowSize } from "ink";
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
  handleSelect: (item: ThemeItem) => Promise<void>;
}

export function useThemeScreen(): ThemeScreenData {
  const { t } = useI18n();
  const { rows } = useWindowSize();

  const themeCenter = container.resolve(ThemeCenter);
  const themeManager = container.resolve(ThemeManager);
  const configStore = container.resolve(ConfigStore);

  const currentId = themeManager.getCurrentId();
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
      await configStore.setTheme(item.theme.id);
    },
    [themeManager, configStore],
  );

  return { items, rows, t, handleSelect };
}
