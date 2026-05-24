import React, { useEffect, useCallback } from "react";
import { Box, Text } from "ink";
import { SelectInput, useKeyboard } from "@baigao_h/ink-kit";
import type { Item } from "@baigao_h/ink-kit";
import { useSettingScreen } from "../hooks/useSettingScreen.js";
import { container } from "../Container.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { SettingRegistry } from "../core/registry/SettingRegistry.js";

function SettingItem({ label, isSelected }: { label: string; value: string; isSelected: boolean }) {
  const colors = useThemeColors();
  return (
    <Box
      width={40}
      borderStyle="round"
      borderColor={isSelected ? colors.highlight : colors.muted}
      paddingX={1}
      marginBottom={1}
    >
      <Box justifyContent="center" width="100%">
        <Text color={isSelected ? colors.highlight : colors.text} bold={isSelected}>
          {label}
        </Text>
      </Box>
    </Box>
  );
}

function DefaultIndicator({ isSelected }: { isSelected: boolean }) {
  const colors = useThemeColors();
  return (
    <Box marginRight={1}>
      <Text color={isSelected ? colors.highlight : undefined}>
        {isSelected ? '❯' : ' '}
      </Text>
    </Box>
  );
}

export default function Setting() {
  const data = useSettingScreen();
  const registry = container.resolve(SettingRegistry);
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();

  // 所有 hooks 在 early return 之前

  useEffect(() => {
    if (data.activeMenu !== "") {
      const unbind = boundKeyboard(["escape"], () => data.onBack());
      return () => unbind();
    }
    return;
  }, [data.activeMenu, data.onBack, boundKeyboard]);

  const items: Item<string>[] = data.menuItems.map((m) => ({
    label: m.label,
    value: m.value,
  }));

  const handleSelect = useCallback(
    (item: Item<string>) => {
      data.onSelectMenu(item);
    },
    [data.onSelectMenu],
  );

  // early return 在所有 hooks 之后
  if (data.activeMenu !== "") {
    const entry = registry.get(data.activeMenu);
    if (!entry) return null;
    const Component = entry.component;
    return React.createElement(Component, { onBack: data.onBack });
  }

  return (
    <Box
      flexDirection="column"
      padding={1}
      width="100%"
      alignItems="center"
      height={data.rows}
    >
      <Box
        width="100%"
        height={3}
        borderColor={colors.text}
        borderStyle="round"
      >
        <Box justifyContent="center" width="100%">
          <Text color={colors.settingTitle} bold>
            {data.t("setting.title")}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <SelectInput
          items={items}
          onSelect={handleSelect}
          focusId="setting-menu"
          itemComponent={SettingItem as any}
          indicatorComponent={DefaultIndicator}
        />
      </Box>
    </Box>
  );
}