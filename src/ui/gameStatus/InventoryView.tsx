import React, { useSyncExternalStore } from "react";
import { Box, Text } from "ink";
import Player from "../../world/Player.js";
import { container } from "../../Container.js";
import ItemRegistry from "../../world/items/ItemRegistry.js";
import { MenuList } from "../kit/index.js";

export default function InventoryView({
  player,
  t,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const itemReg = container.resolve(ItemRegistry);

  // Re-render when the inventory changes (use/remove).
  useSyncExternalStore(
    player.subscribe,
    () => player.inventory.map((s) => `${s.id}:${s.count}`).join(","),
  );

  if (player.inventory.length === 0) {
    return <Text dimColor>{t("game.inventory.empty")}</Text>;
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

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          {t("game.inventory.title")}
        </Text>
        <Text dimColor>  {t("game.inventory.useHint")}</Text>
      </Box>
      <MenuList
        focusId="inventory-list"
        items={entries.map((e) => ({
          value: e.value,
          label: e.label,
          disabled: e.disabled,
        }))}
        onSelect={(item) => player.useItem(item.value)}
        renderItem={(item) => {
          const e = entries.find((x) => x.value === item.value);
          return (
            <Box flexDirection="row">
              <Text dimColor={item.disabled}>{item.label}</Text>
              <Text dimColor> x{e?.count ?? 1}</Text>
            </Box>
          );
        }}
      />
    </Box>
  );
}
