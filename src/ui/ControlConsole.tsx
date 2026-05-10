import React from "react";
import { Box, Text } from "ink";
import { ConsoleNotification } from "../core/console/ConsoleStore.js";
import { useControlConsole } from "../hooks/useControlConsole.js";
import { useKeyboardHandler } from "../hooks/key/useKeyBoardHandle.js";
import { ConsoleCommandResult } from "../core/console/ConsoleStore.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";

const NotificationItem = ({
  notification,
  t,
  colors,
}: {
  notification: ConsoleNotification;
  t: (key: string, params?: Record<string, string | number>) => string;
  colors: ReturnType<typeof useThemeColors>;
}) => {
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
          [mod]{" "}
          {t("mod.message.loadSuccess", { modName: notification.messageKey })}
        </Text>
      );
    case "archive":
      return (
        <Text bold color="magentaBright">
          [archive]{" "}
          {t("archive.message.loadFailed", {
            levelId: notification.messageKey,
          })}
        </Text>
      );
    case "catalogCreation":
      return (
        <Text bold color={colors.info}>
          [archive]{" "}
          {t("archive.message.createFailed", {
            id: notification.messageKey,
          })}
        </Text>
      );
    default:
      return <Text>{t(notification.messageKey)}</Text>;
  }
};

const CommandResultItem = ({
  result,
  t,
}: {
  result: ConsoleCommandResult;
  t: (key: string, params?: Record<string, string | number>) => string;
}) => {
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
};

export default function ControlConsole() {
  const data = useControlConsole();
  const colors = useThemeColors();

  useKeyboardHandler(
    (input, key) => {
      if (data.inputMode) {
        if (key.escape) {
          data.exitInputMode();
          return true;
        }
        if (key.return) {
          data.submitCommand();
          return true;
        }
        if (key.backspace || key.delete) {
          data.setInputText(data.inputText.slice(0, -1));
          return true;
        }
        if (
          input &&
          input.length === 1 &&
          !key.ctrl &&
          !key.meta &&
          !key.tab
        ) {
          data.setInputText(data.inputText + input);
          return true;
        }
        return true;
      } else {
        if (key.tab) {
          data.enterInputMode();
          return true;
        }
        return false;
      }
    },
    [
      data.inputMode,
      data.inputText,
      data.enterInputMode,
      data.exitInputMode,
      data.setInputText,
      data.submitCommand,
    ],
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={colors.consoleBorder}
      width="100%"
      height={16}
      paddingX={1}
      backgroundColor={colors.background}
    >
      <Box justifyContent="space-between">
        <Text color={colors.console} bold>
          {data.t("console.title")}
        </Text>
        <Text dimColor>
          {data.inputMode
            ? "[Esc] " + data.t("console.exitInputMode")
            : "[Tab] " +
              data.t("console.enterInputMode") +
              "  [P] " +
              data.t("console.close")}
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {data.notifications.length === 0 ? (
          <Text dimColor>{data.t("console.empty")}</Text>
        ) : (
          data.notifications
            .slice(0, 4)
            .map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                t={data.t}
                colors={colors}
              />
            ))
        )}
      </Box>

      <Box marginY={1}>
        <Text color={colors.muted}>
          ── {data.t("console.results")} ────────────
        </Text>
      </Box>

      <Box flexDirection="column" flexGrow={1}>
        {data.commandResults.length === 0 ? (
          <Text dimColor>{data.t("console.noResults")}</Text>
        ) : (
          data.commandResults
            .slice(0, 5)
            .map((r) => (
              <CommandResultItem key={r.id} result={r} t={data.t} />
            ))
        )}
      </Box>

      <Box marginTop={1} flexDirection="row">
        {data.inputMode ? (
          <>
            <Text color={colors.warning} bold>
              {"▶ "}
            </Text>
            <Text>{data.inputText}</Text>
            <Text color={colors.muted}>█</Text>
          </>
        ) : (
          <Text dimColor>{data.t("console.inputHint")}</Text>
        )}
      </Box>
    </Box>
  );
}