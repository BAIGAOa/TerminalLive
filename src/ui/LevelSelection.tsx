import React from "react"
import { Box, Text } from "ink"
import { useLevelSelection, LevelItem, DifficultyItem } from "../hooks/useLevelSelection.js"
import { useTerminalSize } from "./TerminalSizeContext.js"
import LevelDetail from "./LevelDetail.js"
import { useKeyboardHandler } from "../hooks/key/useKeyBoardHandle.js"
import SelectInput from "../tools/ui/SelectInput.js"
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js"

const DifficultyBox = (props: DifficultyItem & { isSelected?: boolean }) => {
  const colors = useThemeColors();
  return (
    <Box
      borderStyle="double"
      width="100%"
      height={4}
      borderColor={props.isSelected ? colors.highlight : colors.muted}
    >
      <Box justifyContent="center" width="100%" height={4}>
        <Text bold>{props.label}</Text>
      </Box>
    </Box>
  );
};

const LevelBox = (props: LevelItem & { isSelected?: boolean }) => {
  const colors = useThemeColors();
  let borderColor = colors.muted;
  if (props.status === "unlocked") borderColor = colors.levelUnlocked;
  if (props.status === "completed") borderColor = colors.levelCompleted;
  if (props.isSelected) borderColor = colors.levelSelected;

  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      width="100%"
      paddingX={1}
      marginBottom={1}
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={props.isSelected ? colors.levelSelected : undefined}>
          {props.label}
        </Text>
        <Text dimColor>
          {props.status === "locked" ? "🔒" : props.status === "completed" ? "✓" : ""}
        </Text>
      </Box>
    </Box>
  );
};

interface LevelSelectionProps {
  onBack?: () => void
}

export default function LevelSelection({ onBack }: LevelSelectionProps) {
  const data = useLevelSelection(onBack)
  const { rows } = useTerminalSize()
  const colors = useThemeColors();

  useKeyboardHandler((input, key) => {
    if (data.showDetail) {
      if (key.return || key.escape) {
        data.onKeyPress(input, key)
        return true
      }
      return false
    }

    if (key.escape) {
      data.onKeyPress(input, key)
      return true
    }
    return false
  }, [data.showDetail, data.onKeyPress])

  if (data.showDetail && data.selectedLevel) {
    return (
      <LevelDetail
        level={data.selectedLevel}
        formattedConditions={data.formattedConditions}
        initialAttributes={data.initialAttributes}
        t={data.t}
        onBack={data.onBackFromDetail}
        onConfirm={data.onConfirmEnter}
      />
    )
  }

  return (
    <Box flexDirection="column" width="100%" height={rows} padding={1}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={colors.menuTitle} bold>
          {data.t("levelSelection.title")}
        </Text>
      </Box>

      <Box flexDirection="row" width="100%" flexGrow={1}>
        <Box width="30%" borderStyle="bold" marginRight={1}>
          <SelectInput
            items={data.leftItems}
            onSelect={data.onSelectDifficulty as any}
            itemComponent={DifficultyBox as any}
            isFocused={data.isLeftFocused}
          />
        </Box>

        <Box width="70%" borderStyle="single" borderColor={colors.info} padding={1}>
          {data.activeDifficulty === null ? (
            <Box flexGrow={1} justifyContent="center" alignItems="center">
              <Text dimColor>{data.t("levelSelection.hintSelectDifficulty")}</Text>
            </Box>
          ) : data.rightItems.length === 0 ? (
            <Box flexGrow={1} justifyContent="center" alignItems="center">
              <Text dimColor>{data.t("levelSelection.noLevels")}</Text>
            </Box>
          ) : (
            <SelectInput
              items={data.rightItems}
              onSelect={data.onSelectLevel as any}
              itemComponent={LevelBox as any}
              isFocused={data.isRightFocused}
            />
          )}
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>{data.t("levelSelection.hint")}</Text>
      </Box>
    </Box>
  )
}