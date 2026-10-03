import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { useKeyboard } from "ink-cartridge";
import { MenuList } from "./kit/index.js";
import { useSettingScreen } from "../hooks/useSettingScreen.js";
import { container } from "../Container.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { SettingRegistry } from "../core/registry/SettingRegistry.js";

export default function Setting() {
  const data = useSettingScreen();
  const registry = container.resolve(SettingRegistry);
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();

  useEffect(() => {
    if (data.activeMenu !== "") {
      const u = boundKeyboard(["escape"], () => data.onBack());
      return () => u();
    }
    return;
  }, [data.activeMenu, data.onBack, boundKeyboard]);

  if (data.activeMenu !== "") {
    const entry = registry.get(data.activeMenu);
    if (!entry) return null;
    const Component = entry.component;
    return React.createElement(Component, { onBack: data.onBack });
  }

  const items = data.menuItems.map((m) => ({ value: m.value, label: m.label }));

  return (
    <Box
      flexDirection="column"
      padding={1}
      width="100%"
      alignItems="center"
      height={data.rows}
    >
      <Box width="100%" height={3} borderColor={colors.text} borderStyle="round">
        <Box justifyContent="center" width="100%">
          <Text color={colors.settingTitle} bold>
            {data.t("setting.title")}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1} width={44}>
        <MenuList
          focusId="setting-menu"
          items={items}
          onSelect={(item) => data.onSelectMenu(item)}
          renderItem={(item, state) => (
            <Box
              flexGrow={1}
              borderStyle="round"
              borderColor={state.selected ? colors.highlight : colors.muted}
              paddingX={1}
              justifyContent="center"
            >
              <Text
                bold={state.selected}
                color={state.selected ? colors.highlight : colors.text}
              >
                {item.label}
              </Text>
            </Box>
          )}
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>[Esc] {data.t("game.hint.back")}</Text>
      </Box>
    </Box>
  );
}
