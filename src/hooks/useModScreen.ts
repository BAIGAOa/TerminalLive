import { useState, useCallback } from "react";
import { container } from "../Container.js";
import ModRegistry from "../core/mod/ModRegistry.js";
import ConfigStore from "../core/store/ConfigStore.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useTerminalSize } from "../ui/TerminalSizeContext.js";

export interface ModItem {
  name: string;
  enabled: boolean;
}

export interface ModScreenData {
  mods: ModItem[];
  selectedIndex: number;
  rows: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  handleKeyPress: (
    input: string,
    key: {
      return?: boolean;
      escape?: boolean;
      upArrow?: boolean;
      downArrow?: boolean;
    },
  ) => void;
}

export function useModScreen(onBack?: () => void): ModScreenData {
  const { t } = useI18n();
  const { rows } = useTerminalSize();
  const modRegistry = container.resolve(ModRegistry);
  const configStore = container.resolve(ConfigStore);

  const [enabledSet, setEnabledSet] = useState<Set<string>>(
    () => new Set(configStore.getEnabledMods()),
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  const allNames = modRegistry.getAllMods();

  const mods: ModItem[] = allNames.map((name) => ({
    name,
    enabled: enabledSet.has(name),
  }));

  const handleKeyPress = useCallback(
    (
      _input: string,
      key: {
        return?: boolean;
        escape?: boolean;
        upArrow?: boolean;
        downArrow?: boolean;
      },
    ) => {
      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(mods.length - 1, prev + 1));
      } else if (key.return) {
        if (mods.length === 0) return;
        const modName = mods[selectedIndex].name;
        setEnabledSet((prev) => {
          const next = new Set(prev);
          if (next.has(modName)) {
            next.delete(modName);
          } else {
            next.add(modName);
          }
          configStore.setEnabledMods(Array.from(next));
          return next;
        });
      } else if (key.escape) {
        onBack?.();
      }
    },
    [mods, selectedIndex, configStore, onBack],
  );

  return {
    mods,
    selectedIndex,
    rows,
    t,
    handleKeyPress,
  };
}