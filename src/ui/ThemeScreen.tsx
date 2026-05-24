import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { SelectInput, useKeyboard, useScreenSystem } from "@baigao_h/ink-kit";
import type { Item } from "@baigao_h/ink-kit";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { ThemeColors } from "../core/theme/ThemeDefinition.js";
import { useThemeScreen } from "../hooks/theme/useThemeScreen.js";



function ColorSwatch({ color }: { color: string }) {
  return <Text color={color}>■</Text>;
}

function PreviewSwatches({ colors }: { colors: ThemeColors }) {
  return (
    <Box marginLeft={1} gap={0}>
      <ColorSwatch color={colors.primary} />
      <ColorSwatch color={colors.secondary} />
      <ColorSwatch color={colors.highlight} />
    </Box>
  );
}

function ThemeItem({ label, isSelected, isCurrent }: { label: string; value: string; isSelected: boolean; isCurrent: boolean }) {
  const colors = useThemeColors();
  const borderColor = isSelected
    ? colors.highlight
    : isCurrent
      ? colors.success
      : colors.muted;
  const textColor = isCurrent
    ? colors.success
    : isSelected
      ? colors.highlight
      : colors.text;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      width="100%"
      paddingX={1}
      marginBottom={1}
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={textColor}>
          {isCurrent ? "✓ " : "  "}
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



interface ThemeScreenProps {
  onBack?: () => void;
}

export default function ThemeScreen({ onBack }: ThemeScreenProps) {
  const data = useThemeScreen(onBack);
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { back } = useScreenSystem();

  useEffect(() => {
    const u = boundKeyboard(["escape"], () => {
      if (onBack) onBack();
      else back();
    });
    return () => u();
  }, [onBack, back, boundKeyboard]);

  const items: (Item<string> & { isCurrent: boolean })[] = data.items.map((item) => ({
    label: item.label,
    value: item.value,
    isCurrent: item.isCurrent,
  }));

  return (
    <Box flexDirection="column" padding={1} width="100%" height={data.rows}>
      <Box
        width="100%"
        height={3}
        borderColor={colors.menuTitle}
        borderStyle="round"
        justifyContent="center"
        marginBottom={1}
      >
        <Text color={colors.menuTitle} bold>
          {data.t("themeScreen.title")}
        </Text>
      </Box>

      <Box flexGrow={1} width="100%">
        <SelectInput
          items={items}
          onSelect={(item) => {
            const theme = data.items.find((t) => t.value === item.value);
            if (theme) data.handleSelect(theme);
          }}
          focusId="theme-list"
          itemComponent={ThemeItem as any}
          indicatorComponent={DefaultIndicator}
        />
      </Box>

      {/* 当前主题色块预览 */}
      {(() => {
        const currentTheme = data.items.find((t) => t.isCurrent);
        if (currentTheme) {
          return (
            <Box marginTop={1} flexDirection="row" justifyContent="center">
              <Text dimColor>{data.t("themeScreen.current") || "当前"}: </Text>
              <PreviewSwatches colors={currentTheme.theme.colors} />
            </Box>
          );
        }
        return null;
      })()}

      <Box marginTop={1} justifyContent="center">
        <Text dimColor>{data.t("themeScreen.hint")}</Text>
      </Box>
    </Box>
  );
}