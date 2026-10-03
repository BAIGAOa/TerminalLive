import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { useKeyboard } from "ink-cartridge";
import { ModalFrame } from "./kit/index.js";
import { useI18n } from "../core/language/LanguageContext.js";

const HELP_KEYS: Array<[string, string]> = [
  ["↑ ↓ ⏎", "help.k.nav"],
  ["Tab", "help.k.tab"],
  ["← →", "help.k.view"],
  ["E", "help.k.endTurn"],
  ["P", "help.k.console"],
  ["Q", "help.k.menu"],
  ["?", "help.k.help"],
  ["Ctrl+C", "help.k.quit"],
];

export function HelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { boundKeyboard } = useKeyboard();

  useEffect(() => {
    const uEsc = boundKeyboard(["escape", "?"], () => onClose());
    return () => uEsc();
  }, [boundKeyboard, onClose]);

  return (
    <ModalFrame width={56} title={t("help.title")} borderColor="cyan" draggable>
      <Box flexDirection="column">
        {HELP_KEYS.map(([key, descKey]) => (
          <Box key={key} flexDirection="row">
            <Box width={12}>
              <Text color="cyan">{key}</Text>
            </Box>
            <Text>{t(descKey)}</Text>
          </Box>
        ))}
        <Box marginTop={1}>
          <Text dimColor>{t("help.close")}</Text>
        </Box>
      </Box>
    </ModalFrame>
  );
}
