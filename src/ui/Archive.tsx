import React, { useCallback, useEffect } from "react";
import { Box, Text } from "ink";
import { back, useKeyboard } from "ink-cartridge";
import { ScrollList, TextField } from "./kit/index.js";
import { useArchiveScreen } from "../hooks/useArchiveScreen.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";

export default function Archive({ onBack }: { onBack?: () => void }) {
  // Esc leaves the screen with `back()`, like every sibling screen. `onBack`
  // is an optional override; the screen is opened via `skip(Archive, {})`, so
  // without this fallback Esc would do nothing and only the global menu key
  // would return.
  const goBack = useCallback(() => {
    if (onBack) onBack();
    else back();
  }, [onBack]);
  const data = useArchiveScreen(goBack);
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();

  useEffect(() => {
    const uEsc = boundKeyboard(["escape"], () => data.handleCancel());
    return () => uEsc();
  }, [data.handleCancel, boundKeyboard]);

  useEffect(() => {
    if (data.saveMode) return;
    const u1 = boundKeyboard(["s", "S"], () => data.handleStartSave());
    const u2 = boundKeyboard(["d", "D"], () => data.handleDelete());
    return () => {
      u1();
      u2();
    };
  }, [data.saveMode, data.handleStartSave, data.handleDelete, boundKeyboard]);

  const items = data.saves.map((save) => ({
    value: save.name,
    label: save.name,
  }));

  return (
    <Box flexDirection="column" padding={1} width="100%" height={data.rows}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={colors.menuTitle} bold>
          {data.t("archive.title")}
        </Text>
      </Box>

      {data.saveMode ? (
        <Box flexDirection="column" flexGrow={1}>
          <Box marginBottom={1}>
            <Text>{data.t("archive.enterName")}: </Text>
            <TextField
              value={data.saveName}
              onChange={data.setSaveName}
              onSubmit={data.handleSubmitSave}
              focusId="archive-save-name"
            />
          </Box>
          <Text dimColor>{data.t("archive.saveHint")}</Text>
        </Box>
      ) : data.saves.length === 0 ? (
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Text dimColor>{data.t("archive.empty")}</Text>
        </Box>
      ) : (
        <Box flexDirection="column" flexGrow={1}>
          <ScrollList
            focusId="archive-list"
            itemHeight={4}
            height={Math.max(4, data.rows - 10)}
            pageKeys={false}
            items={items}
            onChange={(_item, index) => data.setSelectedIndex(index)}
            onSelect={(item) => {
              // While a delete is pending, Enter confirms it (matching the
              // confirmation prompt) instead of loading the save.
              if (data.confirmDelete) data.handleDelete();
              else data.loadByName(item.value);
            }}
            renderItem={(item, state) => {
              const save = data.saves.find((s) => s.name === item.value);
              return (
                <Box
                  flexDirection="column"
                  borderStyle="round"
                  borderColor={state.selected ? colors.highlight : colors.muted}
                  paddingX={1}
                >
                  <Text
                    color={state.selected ? colors.highlight : colors.text}
                    bold={state.selected}
                  >
                    {state.selected ? "▶ " : "  "}
                    {item.label}
                  </Text>
                  <Text dimColor>
                    {save?.timestamp
                      ? new Date(save.timestamp).toLocaleString()
                      : ""}{" "}
                    {data.t("archive.playerName")}: {save?.playerName}{" "}
                    {data.t("archive.age")}: {save?.age} v{save?.appVersion}
                  </Text>
                </Box>
              );
            }}
          />
        </Box>
      )}

      {data.confirmDelete && (
        <Box
          marginTop={1}
          borderStyle="double"
          borderColor={colors.danger}
          padding={1}
        >
          <Text color={colors.error}>{data.t("archive.deleteConfirm")}</Text>
        </Box>
      )}

      {data.message && (
        <Box marginTop={1} justifyContent="center">
          <Text color={colors.success}>{data.message}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          {data.confirmDelete
            ? data.t("archive.confirmHint")
            : data.saveMode
              ? data.t("archive.saveModeHint")
              : data.t("archive.hint")}
        </Text>
      </Box>
    </Box>
  );
}
