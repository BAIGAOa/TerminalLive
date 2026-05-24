import React, { useEffect, useMemo } from "react";
import { Box, Text } from "ink";
import { SelectInput, useKeyboard, useScreenSystem } from "@baigao_h/ink-kit";
import type { Item } from "@baigao_h/ink-kit";
import { useLevelSelection } from "../hooks/useLevelSelection.js";
import { useTerminalSize } from "./TerminalSizeContext.js";
import LevelDetail from "./LevelDetail.js";
import LevelGame from "./LevelGame.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";


function DifficultyItem({ label, isSelected }: { label: string; value: string; isSelected: boolean }) {
  const colors = useThemeColors();
  return (
    <Box
      borderStyle="double"
      width="100%"
      height={4}
      borderColor={isSelected ? colors.highlight : colors.muted}
    >
      <Box justifyContent="center" width="100%" height={4}>
        <Text bold>{label}</Text>
      </Box>
    </Box>
  );
}

function LevelItem({ label, isSelected, status }: { label: string; value: string; isSelected: boolean; status: string }) {
  const colors = useThemeColors();
  let borderColor = colors.muted;
  if (status === "unlocked") borderColor = colors.levelUnlocked;
  if (status === "completed") borderColor = colors.levelCompleted;
  if (isSelected) borderColor = colors.levelSelected;

  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      width="100%"
      paddingX={1}
      marginBottom={1}
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={isSelected ? colors.levelSelected : undefined}>
          {label}
        </Text>
        <Text dimColor>
          {status === "locked" ? "🔒" : status === "completed" ? "✓" : ""}
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


interface LevelSelectionProps {
  onBack?: () => void;
}

export default function LevelSelection({ onBack }: LevelSelectionProps) {
  const data = useLevelSelection(onBack);
  const { rows } = useTerminalSize();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { skip } = useScreenSystem();

  // 所有 hooks 必须在任何 early return 之前调用

  useEffect(() => {
    const unbind = boundKeyboard(["escape"], () => {
      if (data.showDetail) {
        data.onBackFromDetail();
      } else if (data.focus === "right") {
        data.onKeyPress("", { escape: true } as any);
      } else {
        onBack?.();
      }
    });
    return () => unbind();
  }, [data, onBack, boundKeyboard]);

  useEffect(() => {
    if (!data.showDetail) return;
    const unbind = boundKeyboard(["return"], () => {
      data.onConfirmEnter();
      skip(LevelGame, {});
    });
    return () => unbind();
  }, [data.showDetail, data.onConfirmEnter, skip, boundKeyboard]);

  const difficultyItems: Item<string>[] = useMemo(
    () =>
      data.leftItems.map((d) => ({
        label: d.label,
        value: d.value,
      })),
    [data.leftItems],
  );

  const levelItems: (Item<string> & { status: string })[] = useMemo(
    () =>
      data.rightItems.map((l) => ({
        label: l.label,
        value: l.value,
        status: l.status,
      })),
    [data.rightItems],
  );

  // early return 在所有 hooks 之后
  if (data.showDetail && data.selectedLevel) {
    return (
      <LevelDetail
        level={data.selectedLevel}
        formattedConditions={data.formattedConditions}
        initialAttributes={data.initialAttributes}
        t={data.t}
        onBack={data.onBackFromDetail}
        onConfirm={() => {
          data.onConfirmEnter();
          skip(LevelGame, {});
        }}
      />
    );
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
            items={difficultyItems}
            onSelect={(item) => {
              const diff = data.leftItems.find((d) => d.value === item.value);
              if (diff) data.onSelectDifficulty(diff);
            }}
            focusId="level-difficulty"
            itemComponent={DifficultyItem as any}
            indicatorComponent={DefaultIndicator}
          />
        </Box>

        <Box
          width="70%"
          borderStyle="single"
          borderColor={colors.info}
          padding={1}
        >
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
              items={levelItems}
              onSelect={(item) => {
                const lvl = data.rightItems.find((l) => l.value === item.value);
                if (lvl) data.onSelectLevel(lvl);
              }}
              focusId="level-list"
              itemComponent={LevelItem as any}
              indicatorComponent={DefaultIndicator}
            />
          )}
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>{data.t("levelSelection.hint")}</Text>
      </Box>
    </Box>
  );
}