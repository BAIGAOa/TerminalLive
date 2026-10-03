import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Box, Text } from "ink";
import { isNormalCharacter, useKeyboard } from "ink-cartridge";
import { MenuList } from "./kit/index.js";
import { container } from "../Container.js";
import ConfigStore from "../core/store/ConfigStore.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { KEY_ACTIONS, resolveKeymap } from "./keymap.js";

const CAPTURABLE_SPECIAL = [
  "up",
  "down",
  "left",
  "right",
  "return",
  "tab",
  "backspace",
  "delete",
  "home",
  "end",
  "pageup",
  "pagedown",
];

export default function KeyBinding({ onBack }: { onBack?: () => void }) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const configStore = container.resolve(ConfigStore);

  const savedJson = useSyncExternalStore(configStore.subscribe, () =>
    JSON.stringify(configStore.getKeyBindings()),
  );
  const keymap = useMemo(
    () => resolveKeymap(JSON.parse(savedJson)),
    [savedJson],
  );

  const [recording, setRecording] = useState<string | null>(null);

  // Esc cancels recording, or leaves the screen.
  useEffect(() => {
    const u = boundKeyboard(["escape"], () => {
      if (recording) setRecording(null);
      else onBack?.();
    });
    return () => u();
  }, [boundKeyboard, recording, onBack]);

  // Capture the next key while recording.
  useEffect(() => {
    if (!recording) return;
    const capture = (key: string) => {
      configStore.setKeyBinding(recording, key);
      setRecording(null);
    };
    const unbinds = [
      boundKeyboard(["*"], (input, k) => {
        if (isNormalCharacter(input, k)) capture(input);
      }),
      ...CAPTURABLE_SPECIAL.map((k) =>
        boundKeyboard([k], () => capture(k)),
      ),
    ];
    return () => unbinds.forEach((u) => u());
  }, [boundKeyboard, recording, configStore]);

  const items = KEY_ACTIONS.map((a) => ({
    value: a.id,
    label: a.labelKey,
  }));

  return (
    <Box flexDirection="column" padding={1} width="100%" alignItems="center">
      <Box marginBottom={1}>
        <Text color={colors.menuTitle} bold>
          {t("key.title")}
        </Text>
      </Box>

      <Box width={56} flexDirection="column">
        <MenuList
          focusId="keybinding-list"
          items={items}
          onSelect={(item) => setRecording(item.value)}
          renderItem={(item, state) => (
            <Box
              flexDirection="row"
              flexGrow={1}
              justifyContent="space-between"
              borderStyle="round"
              borderColor={state.selected ? colors.highlight : colors.muted}
              paddingX={1}
            >
              <Text bold={state.selected}>{t(item.label)}</Text>
              <Text color={colors.warning}>
                {recording === item.value
                  ? t("key.recording")
                  : `[${keymap[item.value]}]`}
              </Text>
            </Box>
          )}
        />
      </Box>

      <Box marginTop={1}>
        <Text dimColor>{t("key.hint")}</Text>
      </Box>
    </Box>
  );
}
