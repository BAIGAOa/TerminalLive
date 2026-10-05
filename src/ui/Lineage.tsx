import React, { useEffect, useState, useSyncExternalStore } from "react";
import { Box, Text } from "ink";
import { useKeyboard, useScreenSystem } from "ink-cartridge";
import { MenuList } from "./kit/index.js";
import { container } from "../Container.js";
import LineageStore from "../core/store/LineageStore.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";

/** 家族谱系 — the family line across generations (from resource/lineage.json). */
export default function Lineage() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { back } = useScreenSystem();
  const store = container.resolve(LineageStore);

  useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const u = boundKeyboard(["escape"], () => back());
    return () => u();
  }, [back, boundKeyboard]);

  // Newest first — the most recent ancestor is the one the next life inherits.
  const history = [...store.getHistory()].reverse();
  const currentGen = store.getNextGeneration();

  const items = history.map((r) => ({
    value: `${r.generation}`,
    label: `${t("lineage.genShort", { n: r.generation })} · ${r.name}`,
  }));

  const record = history[Math.min(selected, history.length - 1)];

  return (
    <Box
      flexDirection="column"
      padding={1}
      width="100%"
      height="100%"
      alignItems="center"
    >
      <Text color={colors.menuTitle} bold>
        {t("lineage.title")}
      </Text>
      <Box marginTop={1}>
        <Text dimColor>
          {history.length === 0
            ? t("lineage.empty")
            : t("lineage.subtitle", { n: history.length, cur: currentGen })}
        </Text>
      </Box>

      {history.length === 0 ? null : (
        <Box flexDirection="row" width="100%" flexGrow={1} marginTop={1}>
          <Box width="40%" marginRight={1}>
            <MenuList
              focusId="lineage-list"
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
            width="60%"
            borderStyle="bold"
            borderColor={colors.info}
            paddingX={1}
          >
            {record ? (
              <>
                <Box flexDirection="row" justifyContent="space-between">
                  <Text bold color={colors.text}>
                    {record.name}
                  </Text>
                  <Text color={colors.info}>
                    {t("lineage.label", { n: record.generation })}
                  </Text>
                </Box>
                <Text color="cyan">{t(record.epithetKey)}</Text>
                <Box marginTop={1} flexDirection="column">
                  <Text>
                    {t("lineage.detail.age", { n: record.age })}
                    {"  ·  "}
                    {t(record.reason === "death" ? "gameover.death" : "gameover.complete")}
                  </Text>
                  <Text color="cyan">
                    {t("gameover.rank")}: {t(record.rankKey)} ({record.score})
                  </Text>
                  <Text color="green">
                    {t("lineage.detail.achievements")}: {record.achievements}
                  </Text>
                  <Text dimColor>
                    {t("lineage.detail.endedAt")}:{" "}
                    {new Date(record.endedAt).toLocaleString()}
                  </Text>
                </Box>
              </>
            ) : null}
          </Box>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>{t("lineage.hint")}</Text>
      </Box>
    </Box>
  );
}
