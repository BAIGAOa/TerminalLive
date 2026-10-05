import React, { useEffect, useState, useSyncExternalStore } from "react";
import { Box, Text } from "ink";
import { useKeyboard, useScreenSystem } from "ink-cartridge";
import { ScrollList } from "./kit/index.js";
import { container } from "../Container.js";
import ItemRegistry from "../world/items/ItemRegistry.js";
import WorldManager from "../worlds/WorldManager.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { useTerminalSize } from "./TerminalSizeContext.js";
import { clampWidth } from "./kit/viewport.js";

/** Spend money on items (priced items only). Uses the shared player. */
export default function Shop() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { back } = useScreenSystem();
  const reg = container.resolve(ItemRegistry);
  const player = container.resolve(WorldManager).getPlayer();
  const { columns, rows } = useTerminalSize();
  const [message, setMessage] = useState<string | null>(null);

  useSyncExternalStore(
    player.subscribe,
    () => `${player.money}|${player.inventory.map((s) => s.id).join(",")}`,
  );

  useEffect(() => {
    const u = boundKeyboard(["escape"], () => back());
    return () => u();
  }, [back, boundKeyboard]);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2500);
  };

  const buy = (id: string) => {
    const def = reg.get(id);
    if (!def || def.price === undefined) return;
    if (player.money < def.price) {
      flash(t("shop.noMoney"));
      return;
    }
    player.applyDelta({ money: -def.price });
    player.addItem(id);
    player.notify();
    flash(t("shop.bought", { name: t(def.labelKey) }));
  };

  const goods = reg.getAll().filter((d) => typeof d.price === "number");
  const items = goods.map((d) => ({
    value: d.id,
    label: `${d.icon ?? "•"} ${d.labelKey === d.id ? d.id : t(d.labelKey)}`,
  }));

  return (
    <Box flexDirection="column" padding={1} width="100%" height="100%" alignItems="center">
      <Text color={colors.menuTitle} bold>
        {t("shop.title")}
      </Text>
      <Box marginTop={1}>
        <Text color={colors.money}>
          {t("player.money")}: ${player.money}
        </Text>
      </Box>

      <Box width={clampWidth(columns, 56)} flexDirection="column" marginTop={1}>
        <ScrollList
          focusId="shop-list"
          itemHeight={3}
          height={Math.max(3, rows - 8)}
          pageKeys={false}
          items={items}
          onSelect={(item) => buy(item.value)}
          renderItem={(item, state) => {
            const def = reg.get(item.value);
            const affordable = (def?.price ?? 0) <= player.money;
            return (
              <Box
                flexDirection="row"
                flexGrow={1}
                justifyContent="space-between"
                borderStyle="bold"
                borderColor={state.selected ? colors.highlight : colors.muted}
                paddingX={1}
              >
                <Text bold={state.selected} color={affordable ? colors.text : colors.muted}>
                  {item.label}
                </Text>
                <Text color={affordable ? colors.money : colors.danger}>${def?.price}</Text>
              </Box>
            );
          }}
        />
      </Box>

      {message && (
        <Box marginTop={1}>
          <Text color={colors.success}>{message}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>{t("shop.hint")}</Text>
      </Box>
    </Box>
  );
}
