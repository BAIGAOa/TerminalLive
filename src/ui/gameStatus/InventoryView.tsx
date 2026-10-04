import React, { useSyncExternalStore } from "react";
import { Box, Text } from "ink";
import Player from "../../world/Player.js";
import { container } from "../../Container.js";
import ItemRegistry from "../../world/items/ItemRegistry.js";
import { ScrollList } from "../kit/index.js";
import { StatusScroll } from "./common.js";
import { useTerminalSize } from "../TerminalSizeContext.js";

export default function InventoryView({
  player,
  t,
  height,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
  height?: number;
}) {
  const itemReg = container.resolve(ItemRegistry);
  const { rows } = useTerminalSize();

  // Re-render when the inventory changes (use/remove).
  useSyncExternalStore(
    player.subscribe,
    () => player.inventory.map((s) => `${s.id}:${s.count}`).join(","),
  );

  if (player.inventory.length === 0) {
    return (
      <StatusScroll
        height={height}
        lines={[<Text dimColor>{t("game.inventory.empty")}</Text>]}
      />
    );
  }

  const entries = player.inventory.map((stack) => {
    const def = itemReg.get(stack.id);
    return {
      value: stack.id,
      label: `${def?.icon ?? "•"} ${t(def?.labelKey ?? stack.id)}`,
      disabled: !def?.usable,
      descKey: def?.descKey,
      count: stack.count,
    };
  });

  // Window the item rows so a long inventory never spills past the panel.
  const viewH = Math.max(1, height ?? Math.max(6, rows - 13));
  const headerH = viewH >= 4 ? 2 : 0;

  return (
    <Box flexDirection="column" height={viewH}>
      {headerH > 0 ? (
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            {t("game.inventory.title")}
          </Text>
          <Text dimColor>  {t("game.inventory.useHint")}</Text>
        </Box>
      ) : null}
      <ScrollList
        focusId="inventory-list"
        group="status-views"
        itemHeight={1}
        height={Math.max(1, viewH - headerH)}
        pageKeys={false}
        items={entries.map((e) => ({
          value: e.value,
          label: e.label,
          disabled: e.disabled,
        }))}
        onSelect={(item) => player.useItem(item.value)}
        renderItem={(item, state) => {
          const e = entries.find((x) => x.value === item.value);
          const active = state.focused && state.selected;
          return (
            <Box flexDirection="row">
              <Text color={active ? "greenBright" : undefined}>
                {active ? "❯ " : "  "}
              </Text>
              <Text dimColor={item.disabled}>{item.label}</Text>
              <Text dimColor> x{e?.count ?? 1}</Text>
            </Box>
          );
        }}
      />
    </Box>
  );
}
