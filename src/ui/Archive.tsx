import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { TextInput, useKeyboard } from "@baigao_h/ink-kit";
import { useArchiveScreen } from "../hooks/useArchiveScreen.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";

export default function Archive({ onBack }: { onBack?: () => void }) {
  const data = useArchiveScreen(onBack);
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();

  // Escape 始终可用（包括保存模式）
  useEffect(() => {
    const unbind = boundKeyboard(["escape"], () => data.handleCancel());
    return () => unbind();
  }, [data.handleCancel, boundKeyboard]);

  // 非保存模式下的按键绑定
  useEffect(() => {
    if (data.saveMode) return;

    const u1 = boundKeyboard(["up"], () => {
      data.setSelectedIndex((i) => Math.max(0, i - 1));
    });
    const u2 = boundKeyboard(["down"], () => {
      data.setSelectedIndex((i) =>
        Math.min(data.saves.length - 1, i + 1),
      );
    });
    const u3 = boundKeyboard(["return"], () => {
      if (data.confirmDelete) {
        data.handleDelete();
      } else {
        data.handleLoad();
      }
    });
    const u4 = boundKeyboard(["s"], () => data.handleStartSave());
    const u5 = boundKeyboard(["S"], () => data.handleStartSave());
    const u6 = boundKeyboard(["d"], () => data.handleDelete());
    const u7 = boundKeyboard(["D"], () => data.handleDelete());

    return () => {
      u1(); u2(); u3(); u4(); u5(); u6(); u7();
    };
  }, [
    data.saveMode,
    data.confirmDelete,
    data.saves.length,
    data.setSelectedIndex,
    data.handleLoad,
    data.handleDelete,
    data.handleCancel,
    data.handleStartSave,
    boundKeyboard,
  ]);

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
            <TextInput
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
          {data.saves.map((save, index) => {
            const isSelected = index === data.selectedIndex;
            return (
              <Box
                key={save.name}
                borderStyle="round"
                borderColor={isSelected ? colors.highlight : colors.muted}
                paddingX={1}
                marginBottom={1}
                flexDirection="column"
              >
                <Text
                  color={isSelected ? colors.highlight : colors.text}
                  bold={isSelected}
                >
                  {isSelected ? "▶ " : "  "}
                  {save.name}
                </Text>
                <Text dimColor>
                  {save.timestamp
                    ? new Date(save.timestamp).toLocaleString()
                    : ""}{" "}
                  {data.t("archive.playerName")}: {save.playerName}{" "}
                  {data.t("archive.age")}: {save.age}{" "}
                  v{save.appVersion}
                </Text>
              </Box>
            );
          })}
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
          {data.saveMode
            ? data.t("archive.saveModeHint")
            : data.t("archive.hint")}
        </Text>
      </Box>
    </Box>
  );
}