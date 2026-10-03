import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { useKeyboard } from "ink-cartridge";
import {
  ConsoleNotification,
  ConsoleCommandResult,
} from "../core/console/ConsoleStore.js";
import { useControlConsole } from "../hooks/useControlConsole.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { ModalFrame, TextField } from "./kit/index.js";

function NotificationItem({
  notification,
  t,
  colors,
}: {
  notification: ConsoleNotification;
  t: (key: string, params?: Record<string, string | number>) => string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  switch (notification.type) {
    case "achievement":
      return (
        <Text color={colors.achievement}>
          ★ {t("achievement.unlock")} {t(notification.messageKey)}
        </Text>
      );
    case "mod":
      return (
        <Text color={colors.error}>
          [mod] {t("mod.message.loadSuccess", { modName: notification.messageKey })}
        </Text>
      );
    case "modReload":
      return (
        <Text color={colors.info}>
          [mod] {t(notification.messageKey, notification.messageParams)}
        </Text>
      );
    case "archive":
      return (
        <Text bold color="magentaBright">
          [archive] {t("archive.message.loadFailed", { levelId: notification.messageKey })}
        </Text>
      );
    case "catalogCreation":
      return (
        <Text bold color={colors.info}>
          [archive] {t("archive.message.createFailed", { id: notification.messageKey })}
        </Text>
      );
    default:
      return <Text>{t(notification.messageKey)}</Text>;
  }
}

function CommandResultItem({
  result,
  t,
}: {
  result: ConsoleCommandResult;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const colors = useThemeColors();
  const color =
    result.type === "success"
      ? colors.success
      : result.type === "error"
        ? colors.error
        : colors.info;
  const text = result.messageKey
    ? t(result.messageKey, result.messageParams as Record<string, string | number>)
    : (result.message ?? "");
  return <Text color={color}>{text}</Text>;
}

export default function ControlConsole({ onClose }: { onClose: () => void }) {
  const data = useControlConsole();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();

  useEffect(() => {
    const uEsc = boundKeyboard(["escape"], () => onClose());
    const uTab = boundKeyboard(["tab"], () => {
      if (!data.inputMode) data.enterInputMode();
    });
    return () => {
      uEsc();
      uTab();
    };
  }, [boundKeyboard, onClose, data.inputMode, data.enterInputMode]);

  return (
    <ModalFrame
      width={76}
      height={18}
      title={data.t("console.title")}
      borderColor={colors.consoleBorder}
      draggable
    >
      <Box flexDirection="column" flexGrow={1}>
        <Box justifyContent="flex-end">
          <Text dimColor>
            {data.inputMode
              ? "[Esc] " + data.t("console.exitInputMode")
              : "[Tab] " + data.t("console.enterInputMode") + "  [Esc] " + data.t("console.close")}
          </Text>
        </Box>

        <Box flexDirection="column">
          {data.notifications.length === 0 ? (
            <Text dimColor>{data.t("console.empty")}</Text>
          ) : (
            data.notifications
              .slice(0, 4)
              .map((n) => (
                <NotificationItem key={n.id} notification={n} t={data.t} colors={colors} />
              ))
          )}
        </Box>

        <Box marginY={1}>
          <Text color={colors.muted}>── {data.t("console.results")} ────────────</Text>
        </Box>

        <Box flexDirection="column" flexGrow={1}>
          {data.commandResults.length === 0 ? (
            <Text dimColor>{data.t("console.noResults")}</Text>
          ) : (
            data.commandResults
              .slice(0, 4)
              .map((r) => <CommandResultItem key={r.id} result={r} t={data.t} />)
          )}
        </Box>

        <Box marginTop={1} flexDirection="row">
          {data.inputMode ? (
            <>
              <Text color={colors.warning} bold>
                {"▶ "}
              </Text>
              <TextField
                value={data.inputText}
                onChange={data.setInputText}
                onSubmit={data.submitCommand}
                focusId="console-input"
              />
            </>
          ) : (
            <Text dimColor>{data.t("console.inputHint")}</Text>
          )}
        </Box>
      </Box>
    </ModalFrame>
  );
}
