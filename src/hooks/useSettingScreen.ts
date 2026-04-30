import { useCallback, useState } from "react";
import { useI18n } from "../core/language/LanguageContext.js";
import { useTerminalSize } from "../ui/TerminalSizeContext.js";
import KeyboardMonitor from "../core/keys/KeyboardMonitor.js";

export enum SettingMenu {
  none = "none",
  keyBoardConfig = "keyBoardConfig",
  playerConfig = "playerConfig",
  modManager = "modManager",
}

export interface SettingItem {
  label: string;
  highlightColor: string;
  value: SettingMenu;
}

export interface SettingScreenData {
  activeMenu: SettingMenu;
  menuItems: Array<{
    label: string;
    value: SettingMenu;
    highlightColor: string;
  }>;
  rows: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  onSelectMenu: (item: { value: SettingMenu }) => void;
  onBack: () => void;
  onConfigChange: (newMonitor: KeyboardMonitor) => void;
}

function buildSettingItem(
  t: (key: string, params?: Record<string, string | number>) => string,
): SettingItem[] {
  const items = Object.values(SettingMenu).filter(
    (each) => each !== SettingMenu.none,
  );

  return items.map((each) => {
    return {
      label: t(`setting.${each}`),
      highlightColor: "green",
      value: each,
    };
  });
}

export function useSettingScreen(
  onConfigChange?: (newMonitor: KeyboardMonitor) => void,
): SettingScreenData {
  const { t } = useI18n();
  const { rows } = useTerminalSize();
  const [activeMenu, setActiveMenu] = useState<SettingMenu>(SettingMenu.none);

  const menuItems = buildSettingItem(t);

  const onSelectMenu = useCallback((item: { value: SettingMenu }) => {
    setActiveMenu(item.value);
  }, []);

  const onBack = useCallback(() => {
    setActiveMenu(SettingMenu.none);
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
