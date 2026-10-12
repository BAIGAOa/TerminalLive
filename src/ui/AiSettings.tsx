import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useKeyboard } from "ink-cartridge";
import { container } from "../Container.js";
import ConfigStore from "../core/store/ConfigStore.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { TextField } from "./kit/index.js";

/**
 * Settings → AI interview.
 *
 * Holds the one secret the game needs: a DeepSeek API key. Empty means the
 * feature is off, and hiring falls back to the numeric entry gates — a player
 * who never opens this page never notices the feature exists.
 */
export default function AiSettings({ onBack }: { onBack?: () => void }) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const configStore = container.resolve(ConfigStore);

  const [draft, setDraft] = useState(configStore.getDeepseekApiKey());
  const [saved, setSaved] = useState(false);
  const [frequency, setFrequency] = useState(configStore.getMailFrequency());

  useEffect(() => {
    const u = boundKeyboard(["escape"], () => onBack?.());
    return () => u();
  }, [onBack, boundKeyboard]);

  // The frequency row is a three-way switch, so ←/→ walk it. It lives outside
  // the text field's focus target, which is why it needs its own bindings.
  useEffect(() => {
    const order: Array<"off" | "low" | "normal"> = ["off", "low", "normal"];
    const step = (delta: number) => {
      const next = order[(order.indexOf(frequency) + delta + order.length) % order.length];
      setFrequency(next);
      void configStore.setMailFrequency(next);
    };
    const left = boundKeyboard(["left"], () => step(-1));
    const right = boundKeyboard(["right"], () => step(1));
    return () => {
      left();
      right();
    };
  }, [boundKeyboard, frequency, configStore]);

  const commit = (value: string) => {
    void configStore.setDeepseekApiKey(value);
    setSaved(value.trim().length > 0);
  };

  const configured = configStore.getDeepseekApiKey().length > 0;

  return (
    <Box flexDirection="column" padding={1} width="100%" alignItems="center">
      <Box marginBottom={1}>
        <Text color={colors.menuTitle} bold>
          {t("setting.ai")}
        </Text>
      </Box>

      <Box width={64} flexDirection="column">
        <Text wrap="wrap" dimColor>
          {t("ai.intro")}
        </Text>

        <Box marginTop={1} flexDirection="row">
          <Text color={colors.text}>{t("ai.keyLabel")} </Text>
          <Text color={configured ? colors.success : colors.muted}>
            {configured ? t("ai.keySet") : t("ai.keyUnset")}
          </Text>
        </Box>

        <Box marginTop={1} flexDirection="row">
          <Text color={colors.info}>{"› "}</Text>
          <TextField
            value={draft}
            onChange={setDraft}
            onSubmit={commit}
            focusId="ai-key"
            mask="•"
            placeholder="sk-…"
          />
        </Box>

        <Box marginTop={1}>
          <Text dimColor wrap="wrap">
            {t("ai.storageNotice")}
          </Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text color={colors.text}>
            {t("ai.frequency")}
            {"  "}
            <Text color={frequency === "off" ? colors.muted : colors.warning} bold>
              {"◄ "}
              {t(`ai.frequency.${frequency}`)}
              {" ►"}
            </Text>
          </Text>
          <Text dimColor wrap="wrap">
            {t(`ai.frequency.${frequency}.hint`)}
          </Text>
        </Box>

        {saved ? (
          <Box marginTop={1}>
            <Text color={colors.success}>{t("ai.saved")}</Text>
          </Box>
        ) : null}

        <Box marginTop={1} flexDirection="column">
          <Text dimColor>{t("ai.hint.submit")}</Text>
          <Text dimColor>{t("ai.hint.clear")}</Text>
          <Text dimColor>{t("common.escHint")}</Text>
        </Box>
      </Box>
    </Box>
  );
}
