import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { SelectInput, useKeyboard } from "@baigao_h/ink-kit";
import type { Item } from "@baigao_h/ink-kit";
import { useModScreen } from "../hooks/useModScreen.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";

function ModItem({ label, isSelected }: { label: string; value: string; isSelected: boolean }) {
  const colors = useThemeColors();
  return (
    <Box
      borderStyle="round"
      borderColor={isSelected ? colors.highlight : colors.muted}
      paddingX={1}
      marginBottom={1}
    >
      <Text color={isSelected ? colors.highlight : colors.text} bold={isSelected}>
        {label}
      </Text>
    </Box>
  );
}

function DefaultIndicator({ isSelected }: { isSelected: boolean }) {
  const colors = useThemeColors();
  return (
    <Box marginRight={1}>
      <Text color={isSelected ? colors.highlight : undefined}>
        {isSelected ? '❯' : ' '}
      </Text>
    </Box>
  );
}

export default function ModManager({ onBack }: { onBack?: () => void }) {
  const { mods, toggleMod, rows, t } = useModScreen();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();

  useEffect(() => {
    const unbind = boundKeyboard(["escape"], () => onBack?.());
    return () => unbind();
  }, [onBack, boundKeyboard]);

  const items: Item<string>[] = mods.map((mod) => ({
    label: `${mod.enabled ? "[✓]" : "[ ]"} ${mod.name}`,
    value: mod.name,
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
        <Box flexDirection="column" flexGrow={1}>
          <SelectInput
            items={items}
            onSelect={(item) => toggleMod(item.value)}
            focusId="mod-list"
            itemComponent={ModItem as any}
            indicatorComponent={DefaultIndicator}
          />
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>{t("mod.restartHint")}</Text>
      </Box>
    </Box>
  );
}