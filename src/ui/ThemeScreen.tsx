import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { useKeyboard } from "ink-cartridge";
import { ScrollList } from "./kit/index.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { ThemeColors } from "../core/theme/ThemeDefinition.js";
import { useThemeScreen } from "../hooks/theme/useThemeScreen.js";
import { useTerminalSize } from "./TerminalSizeContext.js";

function PreviewSwatches({ colors }: { colors: ThemeColors }) {
  return (
    <Box marginLeft={1}>
      <Text color={colors.primary}>■</Text>
      <Text color={colors.secondary}>■</Text>
      <Text color={colors.highlight}>■</Text>
    </Box>
  );
}

export default function ThemeScreen({ onBack }: { onBack?: () => void }) {
  const data = useThemeScreen();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { rows } = useTerminalSize();

  useEffect(() => {
    const u = boundKeyboard(["escape"], () => onBack?.());
    return () => u();
  }, [onBack, boundKeyboard]);

  const items = data.items.map((item) => ({
    value: item.value,
    label: item.label,
  }));

  const current = data.items.find((t) => t.isCurrent);

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
        <ScrollList
          focusId="theme-list"
          itemHeight={3}
          height={Math.max(3, rows - 9)}
          pageKeys={false}
          items={items}
          onSelect={(item) => {
            const theme = data.items.find((t) => t.value === item.value);
            if (theme) data.handleSelect(theme);
          }}
          renderItem={(item, state) => {
            const theme = data.items.find((t) => t.value === item.value);
            const isCurrent = theme?.isCurrent;
            const borderColor = state.selected
              ? colors.highlight
              : isCurrent
                ? colors.success
                : colors.muted;
            return (
              <Box
                flexDirection="row"
                justifyContent="space-between"
                borderStyle="round"
                borderColor={borderColor}
                flexGrow={1}
                paddingX={1}
              >
                <Text
                  bold
                  color={
                    isCurrent
                      ? colors.success
                      : state.selected
                        ? colors.highlight
                        : colors.text
                  }
                >
                  {isCurrent ? "✓ " : "  "}
                  {item.label}
                </Text>
              </Box>
            );
          }}
        />
      </Box>

      {current ? (
        <Box marginTop={1} flexDirection="row" justifyContent="center">
          <Text dimColor>{data.t("themeScreen.current")}: </Text>
          <PreviewSwatches colors={current.theme.colors} />
        </Box>
      ) : null}

      <Box marginTop={1} justifyContent="center">
        <Text dimColor>{data.t("themeScreen.hint")}</Text>
      </Box>
    </Box>
  );
}
