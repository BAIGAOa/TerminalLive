import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { useKeyboard, useScreenSystem } from "ink-cartridge";
import { MenuList, ScrollList } from "./kit/index.js";
import { useWorldSelection } from "../hooks/useWorldSelection.js";
import { fitPanelSections } from "./menuLayout.js";
import { statusViewHeight } from "./kit/viewport.js";
import { useTerminalSize } from "./TerminalSizeContext.js";
import WorldGame from "./WorldGame.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";

export default function WorldSelection() {
  const data = useWorldSelection();
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

  // Sections for the filler panel under the difficulty list, in priority
  // order. `height` is the section's row count (header + content); the panel
  // border is accounted for inside fitPanelSections.
  const panelSections: { key: string; height: number; node: React.ReactNode }[] = [];
  if (data.activeDifficulty !== null) {
    panelSections.push({
      key: "effects",
      height: 1 + Math.max(1, data.difficultyEffects.length),
      node: (
        <>
          <Text color={colors.menuTitle} bold>
            {data.t("levelSelection.effectsTitle")}
          </Text>
          {data.difficultyEffects.map((line, i) => (
            <Text key={i} color={colors.text} wrap="truncate">
              {line}
            </Text>
          ))}
        </>
      ),
    });
  }
  panelSections.push({
    key: "progress",
    height: 1 + data.progressOverview.length,
    node: (
      <>
        <Text color={colors.menuTitle} bold>
          {data.t("levelSelection.progressTitle")}
        </Text>
        {data.progressOverview.map((p, i) => (
          <Text key={i} wrap="truncate">
            <Text color={p.complete ? colors.levelCompleted : colors.text}>{p.name}</Text>
            <Text dimColor>{`  ${p.done}/${p.total}`}</Text>
            {p.complete ? <Text color={colors.levelCompleted}>{" ✓"}</Text> : null}
          </Text>
        ))}
      </>
    ),
  });
  panelSections.push({
    key: "legend",
    height: 5,
    node: (
      <>
        <Text color={colors.menuTitle} bold>
          {data.t("levelSelection.legendTitle")}
        </Text>
        <Text>
          <Text color={colors.levelCompleted}>{"✓ "}</Text>
          <Text dimColor>{data.t("levelSelection.legendCompleted")}</Text>
        </Text>
        <Text>
          <Text dimColor>{"🔒 "}</Text>
          <Text dimColor>{data.t("levelSelection.legendLocked")}</Text>
        </Text>
        <Text>
          <Text color={colors.levelUnlocked}>{"● "}</Text>
          <Text dimColor>{data.t("levelSelection.legendUnlocked")}</Text>
        </Text>
        <Text dimColor wrap="truncate">
          {data.t("levelSelection.legendControls")}
        </Text>
      </>
    ),
  });

  const visibleKeys = fitPanelSections(rows, diffItems.length * 3, panelSections);
  const visibleSections = panelSections.filter((s) => visibleKeys.includes(s.key));

  return (
    <Box flexDirection="column" width="100%" height={rows} padding={1}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={colors.menuTitle} bold>
          {data.t("levelSelection.title")}
        </Text>
      </Box>

      <Box flexDirection="row" width="100%" flexGrow={1}>
        <Box width="30%" marginRight={1} flexDirection="column">
          <MenuList
            focusId="level-difficulty"
            items={diffItems}
            onSelect={(item) => {
              const diff = data.leftItems.find((d) => d.value === item.value);
              if (diff) data.onSelectDifficulty(diff);
            }}
            renderItem={(item, state) => (
              <Box
                borderStyle="bold"
                borderColor={state.selected ? colors.highlight : colors.muted}
                paddingX={1}
                justifyContent="center"
              >
                <Text bold={state.selected}>{item.label}</Text>
              </Box>
            )}
          />
          {visibleSections.length > 0 ? (
            <>
              <Box flexGrow={1} />
              <Box
                flexDirection="column"
                borderStyle="bold"
                borderColor={colors.info}
                paddingX={1}
              >
                {visibleSections.map((s, i) => (
                  <Box
                    key={s.key}
                    flexDirection="column"
                    marginTop={i === 0 ? 0 : 1}
                  >
                    {s.node}
                  </Box>
                ))}
              </Box>
            </>
          ) : null}
        </Box>

        <Box
          width="70%"
          borderStyle="bold"
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
              height={statusViewHeight(rows, { min: 3, reserved: 14 })}
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
                skip(WorldGame, {});
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
                    borderStyle="bold"
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
        borderStyle="bold"
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
                  ? data.t(`tag.${data.highlightedDifficulty}`) ||
                    data.highlightedDifficulty
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
