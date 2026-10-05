import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { useKeyboard, useScreenSystem } from "ink-cartridge";
import { MenuList } from "./kit/index.js";
import { useLanguageScreen } from "../hooks/useLanguageScreen.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";

export default function Language() {
  const data = useLanguageScreen();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { back } = useScreenSystem();

  useEffect(() => {
    const u = boundKeyboard(["escape"], () => back());
    return () => u();
  }, [back, boundKeyboard]);

  const items = data.items.map((item) => ({
    value: item.value,
    label: item.label,
  }));

  return (
    <Box flexDirection="column" padding={1} width="100%" height={data.rows}>
      <Box justifyContent="center">
        <Text color={colors.menuTitle}>
          {data.t("language.title", { language: data.currentLangCode })}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <MenuList
          focusId="language-list"
          items={items}
          onSelect={(item) => data.onSelectLanguage(item)}
          renderItem={(item, state) => (
            <Box
              flexGrow={1}
              borderStyle="bold"
              borderColor={state.selected ? colors.highlight : colors.muted}
              paddingX={1}
              justifyContent="center"
            >
              <Text color={state.selected ? colors.highlight : colors.text}>
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
  );
}
