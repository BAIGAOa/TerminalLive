import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { useKeyboard } from "ink-cartridge";
import { MenuList } from "./kit/index.js";
import { useModScreen } from "../hooks/useModScreen.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";

export default function ModManager({ onBack }: { onBack?: () => void }) {
  const { mods, toggleMod, rows, t } = useModScreen();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();

  useEffect(() => {
    const u = boundKeyboard(["escape"], () => onBack?.());
    return () => u();
  }, [onBack, boundKeyboard]);

  const items = mods.map((mod) => ({
    value: mod.name,
    label: `${mod.enabled ? "[✓]" : "[ ]"} ${mod.name}`,
  }));

  return (
    <Box flexDirection="column" padding={1} width="100%" height={rows}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={colors.menuTitle} bold>
          {t("mod.title")}
        </Text>
      </Box>

      {mods.length === 0 ? (
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Text dimColor>{t("mod.noMods")}</Text>
        </Box>
      ) : (
        <MenuList
          focusId="mod-list"
          items={items}
          onSelect={(item) => toggleMod(item.value)}
          renderItem={(item, state) => (
            <Box
              borderStyle="round"
              borderColor={state.selected ? colors.highlight : colors.muted}
              paddingX={1}
            >
              <Text
                color={state.selected ? colors.highlight : colors.text}
                bold={state.selected}
              >
                {item.label}
              </Text>
            </Box>
          )}
        />
      )}

      <Box marginTop={1}>
        <Text dimColor>{t("mod.restartHint")}</Text>
      </Box>
    </Box>
  );
}
