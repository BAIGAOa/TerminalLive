import React from "react";
import { Box, Text } from "ink";
import { MenuList } from "./kit/index.js";
import type { GameScreenData } from "../hooks/useLevelGameScreen.js";

/**
 * The action list for the current year. Unavailable actions render disabled
 * (grey) and cannot be selected. Both keyboard and mouse drive the same list.
 */
export function ActionPanel({ data }: { data: GameScreenData }) {
  const { t, actionViews, actionPoints, maxActionPoints } = data;

  const items = actionViews.map((a) => ({
    value: a.def.id,
    label: `${a.def.icon ?? "•"} ${t(a.def.labelKey)}`,
    disabled: !a.available,
  }));

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color="cyan">
          {t("game.actions.title")}
        </Text>
        <Text color="yellow">
          {t("game.actions.ap", { ap: actionPoints, max: maxActionPoints })}
        </Text>
      </Box>
      {items.length === 0 ? (
        <Text dimColor>{t("game.actions.none")}</Text>
      ) : (
        <MenuList
          focusId="game-actions"
          items={items}
          onSelect={(item) => data.performAction(item.value)}
          renderItem={(item, state) => {
            const av = actionViews.find((a) => a.def.id === item.value);
            return (
              <Box flexDirection="row" flexGrow={1} justifyContent="space-between">
                <Text
                  bold={state.selected}
                  color={
                    item.disabled
                      ? "gray"
                      : state.selected
                        ? "greenBright"
                        : "white"
                  }
                >
                  {item.label}
                </Text>
                <Text dimColor>AP{av?.def.apCost ?? 1}</Text>
              </Box>
            );
          }}
        />
      )}
    </Box>
  );
}
