import React from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import { useLevelSelection, LevelItem, DifficultyItem } from "../hooks/useLevelSelection.js";
import { useTerminalSize } from "./TerminalSizeContext.js";
import LevelDetail from "./LevelDetail.js";

/** 左侧难度菜单项 */
const DifficultyBox = (props: DifficultyItem & { isSelected?: boolean }) => (
  <Box
    borderStyle="double"
    width="100%"
    height={4}
    borderColor={props.isSelected ? "blue" : "gray"}
  >
    <Box justifyContent="center" width="100%" height={4}>
      <Text bold>{props.label}</Text>
    </Box>
  </Box>
);

/** 右侧关卡根据状态决定边框颜色 */
const LevelBox = (props: LevelItem & { isSelected?: boolean }) => {
  let borderColor = "gray";
  if (props.status === "unlocked") borderColor = "yellow";
  if (props.status === "completed") borderColor = "green";
  if (props.isSelected) borderColor = "white";

  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      width="100%"
      paddingX={1}
      marginBottom={1}
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={props.isSelected ? "white" : undefined}>
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
  onBack?: () => void;
}

export default function LevelSelection({ onBack }: LevelSelectionProps) {
  const data = useLevelSelection(onBack);
  const { rows } = useTerminalSize();

  useInput((input, key) => {
    data.onKeyPress(input, key);
  });

 
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
    );
  }

  
  return (
    <Box flexDirection="column" width="100%" height={rows} padding={1}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color="yellow" bold>
          {data.t("levelSelection.title")}
        </Text>
      </Box>

      <Box flexDirection="row" width="100%" flexGrow={1}>
        {/* 左侧难度列表 */}
        <Box width="30%" borderStyle="bold" marginRight={1}>
          <SelectInput
            items={data.leftItems}
            onSelect={data.onSelectDifficulty as any}
            itemComponent={DifficultyBox as any}
            isFocused={data.isLeftFocused}
          />
        </Box>

        {/* 右侧关卡列表 */}
        <Box width="70%" borderStyle="single" borderColor="cyan" padding={1}>
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

      {/* 底部提示 */}
      <Box marginTop={1}>
        <Text dimColor>{data.t("levelSelection.hint")}</Text>
      </Box>
    </Box>
  );
}