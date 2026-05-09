import React from "react";
import { Box, Text } from "ink";
import { useArchiveScreen } from "../hooks/useArchiveScreen.js";
import TextInput from "../tools/ui/TextInput.js";
import { useKeyboardHandler } from "../hooks/key/useKeyBoardHandle.js";

export default function Archive({ onBack }: { onBack?: () => void }) {
  const data = useArchiveScreen(onBack);

  useKeyboardHandler(
    (input, key) => {
      if (data.saveMode) {
        if (key.escape) {
          data.handleCancelSave();
          return true;
        }
        return false;
      }
      if (data.confirmDelete) {
        if (key.escape) {
          data.handleCancel();
          return true;
        }
        if (key.return) {
          data.handleDelete();
          return true;
        }
        return true;
      }
      if (key.upArrow) {
        data.setSelectedIndex((i) => Math.max(0, i - 1));
        return true;
      }
      if (key.downArrow) {
        data.setSelectedIndex((i) =>
          Math.min(data.saves.length - 1, i + 1),
        );
        return true;
      }
      if (key.return) {
        data.handleLoad();
        return true;
      }
      if (key.escape) {
        data.handleCancel();
        return true;
      }
      if (input === "s" || input === "S") {
        data.handleStartSave();
        return true;
      }
      if (input === "d" || input === "D") {
        data.handleDelete();
        return true;
      }
      return false;
    },
    [data.saveMode, data.confirmDelete, data.saves.length],
  );

  return (
    <Box flexDirection="column" padding={1} width="100%" height={data.rows}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color="yellow" bold>
          {data.t("archive.title")}
        </Text>
      </Box>

      {data.saveMode ? (
        <Box flexDirection="column" flexGrow={1}>
          <Box marginBottom={1}>
            <Text>{data.t("archive.enterName")}: </Text>
            <TextInput
              value={data.saveName}
              onChange={data.setSaveName}
              onSubmit={data.handleSubmitSave}
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
          {data.saves.map((save, index) => {
            const isSelected = index === data.selectedIndex;
            return (
              <Box
                key={save.name}
                borderStyle="round"
                borderColor={isSelected ? "green" : "gray"}
                paddingX={1}
                marginBottom={1}
                flexDirection="column"
              >
                <Text color={isSelected ? "green" : "white"} bold={isSelected}>
                  {isSelected ? "▶ " : "  "}
                  {save.name}
                </Text>
                <Text dimColor>
                  {save.timestamp
                    ? new Date(save.timestamp).toLocaleString()
                    : ""}{" "}
                  | {data.t("archive.playerName")}: {save.playerName}{" "}
                  | {data.t("archive.age")}: {save.age}{" "}
                  | v{save.appVersion}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}

      {data.confirmDelete && (
        <Box marginTop={1} borderStyle="double" borderColor="red" padding={1}>
          <Text color="red">{data.t("archive.deleteConfirm")}</Text>
        </Box>
      )}

      {data.message && (
        <Box marginTop={1} justifyContent="center">
          <Text color="green">{data.message}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          {data.saveMode
            ? data.t("archive.saveModeHint")
            : data.t("archive.hint")}
        </Text>
      </Box>
    </Box>
  );
}