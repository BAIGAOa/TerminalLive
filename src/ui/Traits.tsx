import React, { useEffect, useMemo, useSyncExternalStore } from "react";
import { Box, Text } from "ink";
import { useKeyboard, useScreenSystem } from "ink-cartridge";
import { ScrollList } from "./kit/index.js";
import { container } from "../Container.js";
import ConfigStore from "../core/store/ConfigStore.js";
import TraitRegistry from "../world/traits/TraitRegistry.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { useTerminalSize } from "./TerminalSizeContext.js";
import { clampWidth, statusViewHeight } from "./kit/viewport.js";

const MAX_TRAITS = 2;

/** Pick up to two starting traits; applied when a new life begins. */
export default function Traits() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { back } = useScreenSystem();
  const { columns, rows } = useTerminalSize();
  const configStore = container.resolve(ConfigStore);
  const reg = container.resolve(TraitRegistry);

  const savedJson = useSyncExternalStore(configStore.subscribe, () =>
    JSON.stringify(configStore.getTraits()),
  );
  const selected = useMemo<string[]>(
    () => JSON.parse(savedJson) as string[],
    [savedJson],
  );

  useEffect(() => {
    const u = boundKeyboard(["escape"], () => back());
    return () => u();
  }, [back, boundKeyboard]);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      configStore.setTraits(selected.filter((x) => x !== id));
    } else if (selected.length < MAX_TRAITS) {
      configStore.setTraits([...selected, id]);
    }
  };

  const items = reg.getAll().map((d) => ({
    value: d.id,
    label: `${d.icon ?? "•"} ${t(d.labelKey)}`,
  }));

  return (
    <Box
      flexDirection="column"
      padding={1}
      width="100%"
      height="100%"
      alignItems="center"
    >
      <Text color={colors.menuTitle} bold>
        {t("traits.title")}
      </Text>
      <Box marginTop={1}>
        <Text dimColor>{t("traits.hint", { max: MAX_TRAITS })}</Text>
      </Box>

      <Box width={clampWidth(columns, 62)} flexDirection="column" marginTop={1}>
        <ScrollList
          focusId="traits-list"
          itemHeight={4}
          height={statusViewHeight(rows, { min: 4, reserved: 11 })}
          pageKeys={false}
          items={items}
          onSelect={(item) => toggle(item.value)}
          renderItem={(item) => {
            const on = selected.includes(item.value);
            const def = reg.get(item.value);
            return (
              <Box
                flexDirection="column"
                borderStyle="bold"
                borderColor={on ? colors.success : colors.muted}
                paddingX={1}
              >
                <Text color={on ? colors.success : colors.text} bold={on}>
                  {on ? "✓ " : "  "}
                  {item.label}
                </Text>
                <Text dimColor wrap="truncate">{def ? t(def.descKey) : ""}</Text>
              </Box>
            );
          }}
        />
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          {t("traits.selected", {
            list:
              selected.length > 0
                ? selected
                    .map((id) => t(reg.get(id)?.labelKey ?? id))
                    .join(" · ")
                : "-",
          })}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>[Esc] {t("game.hint.back")}</Text>
      </Box>
    </Box>
  );
}
