import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { useKeyboard, useScreenSystem } from "ink-cartridge";
import { MenuList } from "./kit/index.js";
import { useLevelSelection } from "../hooks/useLevelSelection.js";
import { useTerminalSize } from "./TerminalSizeContext.js";
import LevelDetail from "./LevelDetail.js";
import LevelGame from "./LevelGame.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";

export default function LevelSelection() {
  const data = useLevelSelection();
  const { rows } = useTerminalSize();
  const colors = useThemeColors();
  const { boundKeyboard, focusSet } = useKeyboard();
  const { skip, back } = useScreenSystem();

  useEffect(() => {
    const u = boundKeyboard(["escape"], () => {
      if (data.showDetail) data.onBackFromDetail();
      else back();
    });
    return () => u();
  }, [data.showDetail, data.onBackFromDetail, back, boundKeyboard]);

  // Confirm from the detail view. Registered here (page level) as well as in
  // LevelDetail so it does not depend on the child effect having run first.
  useEffect(() => {
    if (!data.showDetail) return;
    const u = boundKeyboard(
      ["return"],
      () => {
        data.onConfirmEnter();
        skip(LevelGame, {});
      },
      { when: () => data.showDetail },
    );
    return () => u();
  }, [data.showDetail, data.onConfirmEnter, skip, boundKeyboard]);

  // Once a difficulty is chosen, move focus onto the level list.
  useEffect(() => {
    if (data.activeDifficulty === null || data.showDetail) return;
    const timer = setTimeout(() => {
      try {
        focusSet("level-list");
      } catch {
        // list not mounted yet
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [data.activeDifficulty, data.showDetail, focusSet]);

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

  const diffItems = data.leftItems.map((d) => ({ value: d.value, label: d.label }));
  const levelItems = data.rightItems.map((l) => ({
    value: l.value,
    label: l.label,
  }));

  return (
    <Box flexDirection="column" width="100%" height={rows} padding={1}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={colors.menuTitle} bold>
          {data.t("levelSelection.title")}
        </Text>
      </Box>

      <Box flexDirection="row" width="100%" flexGrow={1}>
        <Box width="30%" marginRight={1}>
          <MenuList
            focusId="level-difficulty"
            items={diffItems}
            onSelect={(item) => {
              const diff = data.leftItems.find((d) => d.value === item.value);
              if (diff) data.onSelectDifficulty(diff);
            }}
            renderItem={(item, state) => (
              <Box
                borderStyle="double"
                borderColor={state.selected ? colors.highlight : colors.muted}
                paddingX={1}
                justifyContent="center"
              >
                <Text bold={state.selected}>{item.label}</Text>
              </Box>
            )}
          />
        </Box>

        <Box
          width="70%"
          borderStyle="single"
          borderColor={colors.info}
          paddingX={1}
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
            <MenuList
              focusId="level-list"
              items={levelItems}
              onSelect={(item) => {
                const lvl = data.rightItems.find((l) => l.value === item.value);
                if (lvl) data.onSelectLevel(lvl);
              }}
              renderItem={(item, state) => {
                const lvl = data.rightItems.find((l) => l.value === item.value);
                const status = lvl?.status ?? "locked";
                let borderColor = colors.muted;
                if (status === "unlocked") borderColor = colors.levelUnlocked;
                if (status === "completed") borderColor = colors.levelCompleted;
                if (state.selected) borderColor = colors.levelSelected;
                return (
                  <Box
                    borderStyle="round"
                    borderColor={borderColor}
                    flexGrow={1}
                    paddingX={1}
                    justifyContent="space-between"
                  >
                    <Text bold color={state.selected ? colors.levelSelected : undefined}>
                      {item.label}
                    </Text>
                    <Text dimColor>
                      {status === "locked" ? "🔒" : status === "completed" ? "✓" : ""}
                    </Text>
                  </Box>
                );
              }}
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
