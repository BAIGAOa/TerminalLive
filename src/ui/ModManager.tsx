import React, { useEffect } from "react";
import { useKeymap } from "../hooks/useKeymap.js";
import { Box, Text } from "ink";
import { useKeyboard } from "ink-cartridge";
import { MenuList } from "./kit/index.js";
import { useModScreen } from "../hooks/useModScreen.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import type { PluginRow } from "./pluginManagerView.js";
import { statusViewHeight } from "./kit/viewport.js";
import { bindingsFor } from "./keymap.js";

/**
 * The plugin manager.
 *
 * One list for every plugin — the ones the game ships and the ones the player
 * installed — because they are the same kind of thing. Each row says where it
 * came from, whether it is on, and whether it runs trusted or sandboxed.
 */
export default function ModManager({ onBack }: { onBack?: () => void }) {
  const {
    view,
    selectedIndex,
    setSelectedIndex,
    togglePlugin,
    toggleTrust,
    reload,
    rows,
    t,
  } = useModScreen();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { keymap } = useKeymap();

  useEffect(() => {
    const unbinds = [
      boundKeyboard(["escape"], () => onBack?.()),
      // Reload re-mounts plugins, so a change takes effect without a restart.
      boundKeyboard(bindingsFor(keymap.reloadPlugins), () => reload()),
      boundKeyboard(bindingsFor(keymap.toggleTrust), () => toggleTrust(selectedIndex)),
    ];
    return () => unbinds.forEach((u) => u());
  }, [boundKeyboard, onBack, reload, toggleTrust, selectedIndex, keymap]);

  // Rows the list may occupy: everything but the chrome (title, detail panel,
  // hints, padding). Without it a player with twenty mods gets one tall mess.
  const listRows = statusViewHeight(rows, { min: 4, reserved: 9 });
  const selected = view.all[selectedIndex];

  const items = view.all.map((row) => ({
    value: row.key,
    label: rowLabel(row),
  }));

  return (
    <Box flexDirection="column" padding={1} width="100%" height={rows}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={colors.menuTitle} bold>
          {t("mod.title")}
        </Text>
      </Box>

      {view.all.length === 0 ? (
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Text dimColor>{t("mod.noMods")}</Text>
        </Box>
      ) : (
        <MenuList
          focusId="mod-list"
          items={items}
          height={listRows}
          onSelect={(_item, index) => {
            setSelectedIndex(index);
            togglePlugin(index);
          }}
          onChange={(_item, index) => setSelectedIndex(index)}
          renderItem={(item, state) => {
            const row = view.all.find((r) => r.key === item.value);
            return (
              // One line per plugin: with a long list the bordered rows of the
              // other screens cost three rows each, and a player with twenty
              // mods would scroll through six of them at a time.
              <Box flexDirection="row" flexGrow={1} justifyContent="space-between" paddingRight={1}>
                <Text
                  color={state.selected ? colors.highlight : colors.text}
                  bold={state.selected}
                >
                  {item.label}
                </Text>
                {row ? (
                  <Text color={state.selected ? colors.highlight : colors.muted}>
                    {t(
                      row.source === "core"
                        ? "mod.source.core"
                        : row.source === "builtin"
                          ? "mod.source.builtin"
                          : "mod.source.mod",
                    )}{" "}
                    · {t(row.trusted ? "mod.trust.full" : "mod.trust.sandbox")}
                  </Text>
                ) : null}
              </Box>
            );
          }}
        />
      )}

      {selected ? <PluginDetail row={selected} t={t} colors={colors} /> : null}

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>{t("mod.keys")}</Text>
      </Box>
    </Box>
  );
}

/** `[✓] 名称` — one line; the source and trust sit in the right-hand column. */
function rowLabel(row: PluginRow): string {
  const enabled = row.enabled ? "[✓]" : "[ ]";
  return `${enabled} ${row.name}`;
}

function PluginDetail({
  row,
  t,
  colors,
}: {
  row: PluginRow;
  t: (key: string) => string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Box flexDirection="column" marginTop={1} paddingX={1}>
      {row.desc ? <Text color={colors.text}>{row.desc}</Text> : null}
      <Text color={colors.info}>
        {row.id}
        {row.capabilities.length ? `  [${row.capabilities.join(", ")}]` : ""}
      </Text>
      {row.requestedTrust && !row.trusted ? (
        <Text color={colors.warning}>{t("mod.trust.requested")}</Text>
      ) : null}
      <Text dimColor>{t("mod.restartHint")}</Text>
    </Box>
  );
}
