import React, { useEffect } from "react";
import { Box, Text, useWindowSize } from "ink";
import { useKeyboard, useScreenSystem } from "ink-cartridge";
import { MenuList } from "./kit/index.js";
import { useSettingScreen } from "../hooks/useSettingScreen.js";
import { container } from "../Container.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { SettingRegistry } from "../core/registry/SettingRegistry.js";
import { clampWidth } from "./kit/viewport.js";

export default function Setting() {
  const data = useSettingScreen();
  const registry = container.resolve(SettingRegistry);
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { columns } = useWindowSize();
  const { back } = useScreenSystem();

  // Root screen: Esc leaves settings (as the footer promises). Sub-screens bind
  // their own Esc to return to this list.
  useEffect(() => {
    if (data.activeMenu !== "") return;
    const u = boundKeyboard(["escape"], () => back());
    return () => u();
  }, [data.activeMenu, back, boundKeyboard]);

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
      justifyContent="center"
      height={data.rows}
    >
      <Box width={clampWidth(columns, 44)} flexDirection="column">
        <Box height={3} borderColor={colors.text} borderStyle="bold">
          <Box justifyContent="center" width="100%">
            <Text color={colors.settingTitle} bold>
              {data.t("setting.title")}
            </Text>
          </Box>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <MenuList
            focusId="setting-menu"
            items={items}
            onSelect={(item) => data.onSelectMenu(item)}
            renderItem={(item, state) => (
              <Box
                flexGrow={1}
                borderStyle="bold"
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
        <Box marginTop={1} justifyContent="center">
          <Text dimColor>[Esc] {data.t("game.hint.back")}</Text>
        </Box>
      </Box>
    </Box>
  );
}
