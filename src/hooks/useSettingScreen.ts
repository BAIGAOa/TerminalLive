import { useCallback, useState } from "react";
import { useI18n } from "../core/language/LanguageContext.js";
import { useTerminalSize } from "../ui/TerminalSizeContext.js";
import KeyboardMonitor from "../core/keys/KeyboardMonitor.js";


export const SETTING_MENU = {
  none: "none",
  keyBoardConfig: "keyBoardConfig",
  playerConfig: "playerConfig",
  modManager: "modManager",
} as const;

export type SettingMenuId = string;

export interface SettingItem {
  label: string;
  highlightColor: string;
  value: SettingMenuId;
}

export interface SettingScreenData {
  activeMenu: SettingMenuId;
  menuItems: SettingItem[];
  rows: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  onSelectMenu: (item: { value: SettingMenuId }) => void;
  onBack: () => void;
  onConfigChange: (newMonitor: KeyboardMonitor) => void;
}

function buildSettingItem(
  t: (key: string, params?: Record<string, string | number>) => string,
): SettingItem[] {
  const items = Object.values(SETTING_MENU).filter(
    (each) => each !== SETTING_MENU.none,
  );

  return items.map((each) => ({
    label: t(`setting.${each}`),
    highlightColor: "green",
    value: each,
  }));
}

export function useSettingScreen(
  onConfigChange?: (newMonitor: KeyboardMonitor) => void,
): SettingScreenData {
  const { t } = useI18n();
  const { rows } = useTerminalSize();
  const [activeMenu, setActiveMenu] = useState<SettingMenuId>(SETTING_MENU.none);

  const menuItems = buildSettingItem(t);

  const onSelectMenu = useCallback((item: { value: SettingMenuId }) => {
    setActiveMenu(item.value);
  }, []);

  const onBack = useCallback(() => {
    setActiveMenu(SETTING_MENU.none);
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