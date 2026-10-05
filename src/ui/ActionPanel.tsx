import React from "react";
import { Box, Text } from "ink";
import { useFocusState } from "ink-cartridge";
import { ScrollList } from "./kit/index.js";
import type { GameScreenData } from "../hooks/useWorldGameScreen.js";

/**
 * The action list for the current year, virtualised: only the visible rows are
 * rendered and the selection scrolls into view, so a long list (older ages have
 * many actions) never overflows the panel. Unavailable actions render disabled
 * and are skipped by the keyboard. The header shows a focus badge so it is
 * obvious whether ↑↓/⏎ act here.
 */
export function ActionPanel({
  data,
  height,
}: {
  data: GameScreenData;
  /** Rows the panel box can occupy (from the game screen). */
  height?: number;
}) {
  const { t, actionViews, actionPoints, maxActionPoints } = data;
  const focused = useFocusState("game-actions", "game-main");

  const items = actionViews.map((a) => ({
    value: a.def.id,
    label: `${a.def.icon ?? "•"} ${t(a.def.labelKey)}`,
    disabled: !a.available,
  }));

  // Header (title row + margin) eats 2 rows; the rest is the virtual list.
  // Reserve one more row for the "N more below" line when items are hidden.
  const budget = Math.max(1, (height ?? items.length + 3) - 2);
  const hidden = Math.max(0, items.length - budget);
  const listH = Math.max(1, budget - (hidden > 0 ? 1 : 0));

  return (
    <Box flexDirection="column" width="100%">
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color={focused ? "cyanBright" : "gray"}>
          {focused ? "▶" : " "} {t("game.actions.title")}
        </Text>
        <Text color="yellow">
          AP {actionPoints}/{maxActionPoints}
        </Text>
      </Box>
      {items.length === 0 ? (
        <Text dimColor>{t("game.actions.none")}</Text>
      ) : (
        <>
          <ScrollList
            focusId="game-actions"
            group="game-main"
            itemHeight={1}
            height={listH}
            pageKeys={false}
            items={items}
            onSelect={(item) => data.performAction(item.value)}
            renderItem={(item, state) => {
              const av = actionViews.find((a) => a.def.id === item.value);
              // Bright highlight only while this panel owns the keyboard; a
              // merely-selected row dims so it is clear where focus actually is.
              const active = state.focused && state.selected;
              return (
                <Box
                  flexDirection="row"
                  flexGrow={1}
                  justifyContent="space-between"
                >
                  <Text
                    bold={active}
                    wrap="truncate"
                    color={
                      item.disabled ? "gray" : active ? "greenBright" : "white"
                    }
                  >
                    {active ? "❯ " : "  "}
                    {item.label}
                  </Text>
                  <Text dimColor>AP{av?.def.apCost ?? 1}</Text>
                </Box>
              );
            }}
          />
          {hidden > 0 ? (
            <Text color="yellow" wrap="truncate">
              {t("game.actions.more", { n: hidden })}
            </Text>
          ) : null}
        </>
      )}
    </Box>
  );
}
