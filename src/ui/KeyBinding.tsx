import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useWindowSize } from "ink";
import { isNormalCharacter, useKeyboard } from "ink-cartridge";
import { MenuList } from "./kit/index.js";
import { container } from "../Container.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { clampWidth, statusViewHeight } from "./kit/viewport.js";
import ConfigStore from "../core/store/ConfigStore.js";
import { findConflicts } from "./keymap.js";
import { useKeymap } from "../hooks/useKeymap.js";

/** Keys that can be bound but arrive as a named key rather than a character. */
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
  "space",
];

export default function KeyBinding({ onBack }: { onBack?: () => void }) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const configStore = container.resolve(ConfigStore);
  const { columns, rows } = useWindowSize();

  const { keymap, actions } = useKeymap();
  const conflicts = useMemo(
    () => findConflicts(actions, keymap),
    [actions, keymap],
  );
  const labelOf = (actionId: string) => {
    const action = actions.find((a) => a.id === actionId);
    return action ? t(action.labelKey) : actionId;
  };

  const [recording, setRecording] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  // The list of actions can outgrow a short terminal; window it.
  const listRows = statusViewHeight(rows, { min: 4, reserved: 7 });

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
      void configStore.setKeyBinding(recording, key);
      setRecording(null);
    };
    const unbinds = [
      boundKeyboard(["*"], (input, k) => {
        if (isNormalCharacter(input, k)) capture(input);
      }),
      ...CAPTURABLE_SPECIAL.map((k) => boundKeyboard([k], () => capture(k))),
    ];
    return () => unbinds.forEach((u) => u());
  }, [boundKeyboard, recording, configStore]);

  // Reset every binding to its default — in two steps. A single bare `r`
  // wiping the whole configuration is a keystroke away from an accident, so
  // the first press arms it and the second confirms; Esc backs out.
  useEffect(() => {
    if (recording) return;
    const u = boundKeyboard(["r"], () => {
      if (!confirmReset) {
        setConfirmReset(true);
        return;
      }
      setConfirmReset(false);
      void configStore.setKeyBindings({});
    });
    return () => u();
  }, [boundKeyboard, recording, configStore, confirmReset]);

  const items = actions.map((a) => ({ value: a.id, label: a.labelKey }));

  return (
    <Box flexDirection="column" padding={1} width="100%" alignItems="center">
      <Box marginBottom={1}>
        <Text color={colors.menuTitle} bold>
          {t("key.title")}
        </Text>
      </Box>

      <Box width={clampWidth(columns, 56)} flexDirection="column">
        <MenuList
          focusId="keybinding-list"
          items={items}
          height={listRows}
          onSelect={(item) => setRecording(item.value)}
          renderItem={(item, state) => {
            const clash = conflicts[item.value];
            return (
              // One line per action: there are a dozen of them now, and the
              // bordered rows would show five at a time.
              <Box
                flexDirection="row"
                flexGrow={1}
                justifyContent="space-between"
                paddingRight={1}
              >
                <Text bold={state.selected} color={clash ? colors.error : undefined}>
                  {t(item.label)}
                </Text>
                <Text
                  color={clash ? colors.error : state.selected ? colors.highlight : colors.warning}
                >
                  {recording === item.value
                    ? t("key.recording")
                    : `[${keymap[item.value]}]`}
                  {clash
                    ? `  ⚠ ${t("key.conflictWith", {
                        actions: clash.map(labelOf).join(", "),
                      })}`
                    : ""}
                </Text>
              </Box>
            );
          }}
        />
      </Box>

      <Box marginTop={1} flexDirection="column" alignItems="center">
        <Text dimColor>{t("key.hint")}</Text>
        <Text color={confirmReset ? colors.warning : undefined} dimColor={!confirmReset}>
          {t(confirmReset ? "key.hintResetConfirm" : "key.hintReset")}
        </Text>
      </Box>
    </Box>
  );
}
