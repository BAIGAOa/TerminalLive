import { useCallback, useState, useMemo } from "react";
import { container } from "../Container.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useTerminalSize } from "../ui/TerminalSizeContext.js";
import { SettingRegistry } from "../core/store/SettingRegistry.js";
import KeyboardMonitor from "../core/keys/KeyboardMonitor.js";

export type SettingMenuId = string;

export interface SettingItem {
  label: string;
  highlightColor: string;
  value: SettingMenuId;
}

export interface SettingScreenData {
  activeMenu: SettingMenuId | "";
  menuItems: SettingItem[];
  rows: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  onSelectMenu: (item: { value: SettingMenuId }) => void;
  onBack: () => void;
  onConfigChange: (newMonitor: KeyboardMonitor) => void;
}

export function useSettingScreen(
  onConfigChange?: (newMonitor: KeyboardMonitor) => void,
): SettingScreenData {
  const { t } = useI18n();
  const { rows } = useTerminalSize();
  const [activeMenu, setActiveMenu] = useState<SettingMenuId | "">("");

  const registry = container.resolve(SettingRegistry);

  const menuItems: SettingItem[] = useMemo(
    () =>
      registry.getAll().map((entry) => ({
        label: t(entry.nameKey),
        highlightColor: "green",
        value: entry.menu,
      })),
    [registry, t],
  );

  const onSelectMenu = useCallback((item: { value: SettingMenuId }) => {
    setActiveMenu(item.value);
  }, []);

  const onBack = useCallback(() => {
    setActiveMenu("");
  }, []);

  const handleConfigChange = useCallback(
    (newMonitor: KeyboardMonitor) => {
      onConfigChange?.(newMonitor);
    },
    [onConfigChange],
  );

  return {
    activeMenu,
    menuItems,
    rows,
    t,
    onSelectMenu,
    onBack,
    onConfigChange: handleConfigChange,
  };
}