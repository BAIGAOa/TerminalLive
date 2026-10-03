import React, { useEffect, useState, useSyncExternalStore } from "react";
import { Box, Text } from "ink";
import { useKeyboard, useScreenSystem } from "ink-cartridge";
import { MenuList, ScrollPanel } from "./kit/index.js";
import { container } from "../Container.js";
import WorldState from "../world/chronicle/WorldState.js";
import WorldRegistry from "../world/chronicle/WorldRegistry.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";

/** The codex — world lore unlocked as a life unfolds. */
export default function Codex() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { back } = useScreenSystem();
  const world = container.resolve(WorldState);
  const reg = container.resolve(WorldRegistry);

  useSyncExternalStore(world.subscribe, world.getSnapshot);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const u = boundKeyboard(["escape"], () => back());
    return () => u();
  }, [back, boundKeyboard]);

  const lore = reg.getLore();
  const unlockedCount = lore.filter((l) => world.unlockedLore.has(l.id)).length;
  const items = lore.map((l) => ({
    value: l.id,
    label: world.unlockedLore.has(l.id) ? t(l.titleKey) : t("codex.locked"),
  }));

  const current = lore[Math.min(selected, lore.length - 1)];
  const currentUnlocked = current ? world.unlockedLore.has(current.id) : false;

  return (
    <Box flexDirection="column" padding={1} width="100%" height="100%" alignItems="center">
      <Text color={colors.menuTitle} bold>
        {t("codex.title")}
      </Text>
      <Box marginTop={1}>
        <Text dimColor>
          {t("codex.progress", { unlocked: unlockedCount, total: lore.length })}
        </Text>
      </Box>

      <Box flexDirection="row" width="100%" flexGrow={1} marginTop={1}>
        <Box width="38%" marginRight={1}>
          <MenuList
            focusId="codex-list"
            items={items}
            onChange={(_item, index) => setSelected(index)}
            onSelect={(_item, index) => setSelected(index)}
            renderItem={(item, state) => (
              <Text color={state.selected ? colors.highlight : colors.text}>
                {item.label}
              </Text>
            )}
          />
        </Box>

        <Box
          flexDirection="column"
          width="62%"
          borderStyle="round"
          borderColor={colors.info}
          paddingX={1}
        >
          {current ? (
            <>
              <Text bold color={currentUnlocked ? colors.success : colors.muted}>
                {currentUnlocked ? t(current.titleKey) : t("codex.locked")}
              </Text>
              <Box marginTop={1} flexGrow={1}>
                <ScrollPanel
                  height={10}
                  showBar={false}
                  lines={[
                    <Text key="body" color={currentUnlocked ? colors.text : colors.muted}>
                      {currentUnlocked ? t(current.bodyKey) : "…"}
                    </Text>,
                  ]}
                />
              </Box>
            </>
          ) : (
            <Text dimColor>{t("codex.empty")}</Text>
          )}
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>{t("codex.hint")}</Text>
      </Box>
    </Box>
  );
}
