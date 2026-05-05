import React from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useArchiveScreen } from "../hooks/useArchiveScreen.js";

export default function Archive({ onBack }: { onBack?: () => void }) {
  const data = useArchiveScreen(onBack);

  useInput((input, key) => {
    // 命名优先，防止 TextInput 被全局按键干扰
    if (data.saveMode) {
      if (key.escape) data.handleCancelSave();
      return;
    }
    // 删除确认模式
    if (data.confirmDelete) {
      if (key.escape) data.handleCancel();
      if (key.return) data.handleDelete();
      return;
    }
    // 普通模式
    if (key.upArrow)
      data.setSelectedIndex((i: number) => Math.max(0, i - 1));
    if (key.downArrow)
      data.setSelectedIndex((i: number) =>
        Math.min(data.saves.length - 1, i + 1)
      );
    if (key.return) data.handleLoad();
    if (key.escape) data.handleCancel();
    if (input === "s" || input === "S") data.handleStartSave();
    if (input === "d" || input === "D") data.handleDelete();
  });

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
                  {save.timestamp
                    ? new Date(save.timestamp).toLocaleString()
                    : save.name}
                  <Text color='white'> Name: {save.name}</Text>
                </Text>
                <Text dimColor>
                  {data.t("archive.playerName")}: {save.playerName} |{" "}
                  {data.t("archive.age")}: {save.age}
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
