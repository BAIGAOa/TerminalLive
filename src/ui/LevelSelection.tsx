import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { useKeyboard, useScreenSystem } from "ink-cartridge";
import { MenuList, ScrollList } from "./kit/index.js";
import { useLevelSelection } from "../hooks/useLevelSelection.js";
import { useTerminalSize } from "./TerminalSizeContext.js";
import LevelGame from "./LevelGame.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";

export default function LevelSelection() {
  const data = useLevelSelection();
  const { rows } = useTerminalSize();
  const colors = useThemeColors();
  const { boundKeyboard, focusSet } = useKeyboard();
  const { skip, back } = useScreenSystem();

  useEffect(() => {
    const u = boundKeyboard(["escape"], () => back());
    return () => u();
  }, [back, boundKeyboard]);

  // ←/→ move between the difficulty pane and the level pane (the level list
  // isn't mounted until a difficulty is chosen, hence the guarded focus).
  useEffect(() => {
    const safe = (id: string) => {
      try {
        focusSet(id);
      } catch {
        /* target not mounted */
      }
    };
    const uLeft = boundKeyboard(["left"], () => safe("level-difficulty"));
    const uRight = boundKeyboard(["right"], () => safe("level-list"));
    return () => {
      uLeft();
      uRight();
    };
  }, [boundKeyboard, focusSet]);

  // Once a difficulty is chosen, move focus onto the level list.
  useEffect(() => {
    if (data.activeDifficulty === null) return;
    const timer = setTimeout(() => {
      try {
        focusSet("level-list");
      } catch {
        // list not mounted yet
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [data.activeDifficulty, focusSet]);

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
            <ScrollList
              key={data.activeDifficulty ?? "none"}
              focusId="level-list"
              itemHeight={3}
              height={Math.max(3, rows - 14)}
              items={levelItems}
              pageKeys={false}
              onChange={(item) => {
                const lvl = data.rightItems.find((l) => l.value === item.value);
                if (lvl) data.onHighlightLevel(lvl);
              }}
              onSelect={(item) => {
                const lvl = data.rightItems.find((l) => l.value === item.value);
                if (!lvl) return;
                if (lvl.status === "locked") return; // locked: no start (footer explains)
                data.onStartLevel(lvl);
                skip(LevelGame, {});
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
                    width="100%"
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

      {/* inline detail for the highlighted level (replaces a second screen) */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={colors.info}
        paddingX={1}
        marginTop={1}
        overflowY="hidden"
      >
        {data.highlightedDescKey ? (
          <>
            <Text color={colors.text} wrap="truncate">{data.t(data.highlightedDescKey)}</Text>
            <Box flexDirection="row" marginTop={1}>
              <Text dimColor>{data.t("levelDetail.victoryConditions")}: </Text>
              {data.highlightedConditions.length === 0 ? (
                <Text dimColor>{data.t("levelDetail.noConditions")}</Text>
              ) : (
                <Text color={colors.success} wrap="truncate">
                  {data.highlightedConditions
                    .map((c) => c.description)
                    .join("  ·  ")}
                </Text>
              )}
            </Box>
            {data.highlightedStatus === "locked" ? (
              <Text color={colors.muted}>
                {data.t("levelSelection.lockedHint")}
              </Text>
            ) : null}
            <Box flexDirection="row" marginTop={1} gap={2}>
              <Text dimColor>
                {data.t("levelDetail.difficulty")}:{" "}
                {data.highlightedDifficulty
                  ? data.t(`difficulty.${data.highlightedDifficulty}`)
                  : "-"}
              </Text>
              {data.highlightedMedals.total > 0 ? (
                <Text color={colors.achievement}>
                  {data.t("levelDetail.medals", {
                    earned: data.highlightedMedals.earned,
                    total: data.highlightedMedals.total,
                  })}
                </Text>
              ) : null}
            </Box>
            {data.highlightedObjectives.length > 0 ? (
              <Box flexDirection="column">
                {data.highlightedObjectives.slice(0, 3).map((o) => (
                  <Text key={o.id} wrap="truncate" color={o.optional ? colors.warning : colors.text}>
                    {o.optional ? "★ " : "◆ "}
                    {data.t(o.labelKey)}
                    {o.hasReward ? "  🎁" : ""}
                  </Text>
                ))}
                {data.highlightedObjectives.length > 3 ? (
                  <Text dimColor>
                    +{data.highlightedObjectives.length - 3}
                  </Text>
                ) : null}
              </Box>
            ) : null}
          </>
        ) : (
          <Text dimColor>{data.t("levelSelection.hintSelectDifficulty")}</Text>
        )}
      </Box>

      <Box marginTop={1} justifyContent="center">
        <Text dimColor>{data.t("levelSelection.hint")}</Text>
      </Box>
    </Box>
  );
}
