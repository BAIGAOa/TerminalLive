import React, { useEffect, useMemo } from "react";
import { Box, Text } from "ink";
import { useKeyboard } from "ink-cartridge";
import { ModalFrame } from "./kit/index.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { container } from "../Container.js";
import ConfigStore from "../core/store/ConfigStore.js";
import { resolveKeymap } from "./keymap.js";

export function HelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();

  // Drive the legend from the (rebindable) keymap so it never drifts.
  const keymap = resolveKeymap(container.resolve(ConfigStore).getKeyBindings());
  const helpKeys = useMemo<Array<[string, string]>>(
    () => [
      ["↑ ↓ ⏎", "help.k.nav"],
      ["Tab", "help.k.tab"],
      ["← →", "help.k.view"],
      [keymap.endTurn.toUpperCase(), "help.k.endTurn"],
      [keymap.console.toUpperCase(), "help.k.console"],
      [keymap.menu.toUpperCase(), "help.k.menu"],
      [keymap.help, "help.k.help"],
      ["Ctrl+C", "help.k.quit"],
    ],
    [keymap.endTurn, keymap.console, keymap.menu, keymap.help],
  );

  useEffect(() => {
    const u = boundKeyboard(["escape", keymap.help], () => onClose());
    return () => u();
  }, [boundKeyboard, onClose, keymap.help]);

  return (
    <ModalFrame width={56} title={t("help.title")} borderColor={colors.info} draggable>
      <Box flexDirection="column">
        {helpKeys.map(([key, descKey]) => (
          <Box key={key} flexDirection="row">
            <Box width={12}>
              <Text color={colors.info}>{key}</Text>
            </Box>
            <Text>{t(descKey)}</Text>
          </Box>
        ))}
        <Box marginTop={1}>
          <Text dimColor>{t("help.close", { key: keymap.help })}</Text>
        </Box>
      </Box>
    </ModalFrame>
  );
}
