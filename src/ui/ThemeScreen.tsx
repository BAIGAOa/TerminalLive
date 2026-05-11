import React from "react";
import { Box, Text } from "ink";
import SelectInput from "../tools/ui/SelectInput.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import {
  ThemeColors,
  ThemeColorSchema,
} from "../core/theme/ThemeDefinition.js";
import { ThemeItem, useThemeScreen } from "../hooks/theme/useThemeScreen.js";

// 从 Schema 中动态提取颜色字段，保证新增字段自动出现在详细预览中
const ALL_COLOR_KEYS = Object.keys(
  ThemeColorSchema.shape,
) as (keyof ThemeColors)[];

const COLS_PER_ROW = 4;
const COL_WIDTH = 20;

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

function ExpandedColorGrid({ colors }: { colors: ThemeColors }) {
  const rows: (keyof ThemeColors)[][] = [];
  for (let i = 0; i < ALL_COLOR_KEYS.length; i += COLS_PER_ROW) {
    rows.push(ALL_COLOR_KEYS.slice(i, i + COLS_PER_ROW));
  }

  return (
    <Box flexDirection="column" marginTop={1} paddingLeft={1}>
      {rows.map((chunk, rowIdx) => (
        <Box key={rowIdx} gap={0}>
          {chunk.map((key) => (
            <Box key={key} width={COL_WIDTH} marginRight={1}>
              <ColorSwatch color={colors[key]} />
              <Text dimColor> {key}:</Text>
              <Text color={colors[key]}> {colors[key]}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}

interface ThemeItemBoxProps {
  label: string;
  value: string;
  isSelected?: boolean;
  theme: ThemeItem["theme"];
  description: string;
  isCurrent: boolean;
  expanded: boolean;
}

function ThemeItemBox({
  label,
  isSelected,
  theme,
  description,
  isCurrent,
  expanded,
}: ThemeItemBoxProps) {
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
      <Box>
        <Text bold color={textColor}>
          {isCurrent ? "✓ " : "  "}
          {label}
        </Text>
      </Box>

      <Box>
        <Text dimColor>{description || " "}</Text>
        <PreviewSwatches colors={theme.colors} />
      </Box>

      {expanded && <ExpandedColorGrid colors={theme.colors} />}
    </Box>
  );
}

interface ThemeScreenProps {
  onBack?: () => void;
}

export default function ThemeScreen({ onBack }: ThemeScreenProps) {
  const data = useThemeScreen(onBack);
  const colors = useThemeColors();

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
          items={data.items as any}
          onSelect={(item) => data.handleSelect(item as any)}
          itemComponent={(props: any) => (
            <ThemeItemBox
              {...props}
              expanded={data.expandedThemeId === (props as any).value}
            />
          )}
          onKeyPress={(input, key, idx) =>
            data.handleKeyPress(input, key, idx)
          }
        />
      </Box>

      <Box marginTop={1} justifyContent="center">
        <Text dimColor>{data.t("themeScreen.hint")}</Text>
      </Box>
    </Box>
  );
}
