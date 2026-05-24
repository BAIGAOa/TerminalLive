import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { SelectInput, useKeyboard, useScreenSystem } from "@baigao_h/ink-kit";
import type { Item } from "@baigao_h/ink-kit";
import { useLanguageScreen } from "../hooks/useLanguageScreen.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";

function LanguageItem({ label, isSelected }: { label: string; value: string; isSelected: boolean }) {
  const colors = useThemeColors();
  return (
    <Box
      width="100%"
      height={3}
      borderStyle="double"
      borderColor={isSelected ? colors.highlight : "blue"}
    >
      <Box justifyContent="center" width="100%">
        <Text color={isSelected ? colors.highlight : "white"}>{label}</Text>
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

export default function Language() {
  const data = useLanguageScreen();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { back } = useScreenSystem();

  useEffect(() => {
    const u = boundKeyboard(["escape"], () => back());
    return () => u();
  }, [back, boundKeyboard]);

  const items: Item<string>[] = data.items.map((item) => ({
    label: item.label,
    value: item.value,
  }));

  return (
    <Box flexDirection="column" padding={1} width="100%" height={data.rows}>
      <Box justifyContent="center">
        <Text color={colors.menuTitle}>
          {data.t("language.title", { language: data.currentLangCode })}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <SelectInput
          items={items}
          onSelect={(item) => data.onSelectLanguage(item)}
          focusId="language-list"
          itemComponent={LanguageItem as any}
          indicatorComponent={DefaultIndicator}
        />
      </Box>
      <Box marginTop={1} justifyContent="center">
        <Text dimColor>[Esc] 返回</Text>
      </Box>
    </Box>
  );
}