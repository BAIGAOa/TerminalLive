import React, { useEffect, useRef } from "react";
import { Box, Text } from "ink";
import { useKeyboard } from "@baigao_h/ink-kit";
import { ConsoleNotification } from "../core/console/ConsoleStore.js";
import { useControlConsole } from "../hooks/useControlConsole.js";
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
  const { boundKeyboard } = useKeyboard();

  // 用 ref 持有最新值，避免 inputText 变化导致重绑定
  const inputTextRef = useRef(data.inputText);
  inputTextRef.current = data.inputText;

  const inputModeRef = useRef(data.inputMode);
  inputModeRef.current = data.inputMode;

  const exitInputModeRef = useRef(data.exitInputMode);
  exitInputModeRef.current = data.exitInputMode;

  const submitCommandRef = useRef(data.submitCommand);
  submitCommandRef.current = data.submitCommand;

  const setInputTextRef = useRef(data.setInputText);
  setInputTextRef.current = data.setInputText;

  const enterInputModeRef = useRef(data.enterInputMode);
  enterInputModeRef.current = data.enterInputMode;

  // 特殊键绑定（不依赖 inputText 值）
  useEffect(() => {
    const u1 = boundKeyboard(["escape"], () => {
      if (inputModeRef.current) {
        exitInputModeRef.current();
      }
    });
    const u2 = boundKeyboard(["return"], () => {
      if (inputModeRef.current) {
        submitCommandRef.current();
      }
    });
    const u3 = boundKeyboard(["backspace", "delete"], () => {
      if (inputModeRef.current) {
        const v = inputTextRef.current;
        setInputTextRef.current(v.slice(0, -1));
      }
    });
    const u4 = boundKeyboard(["tab"], () => {
      if (!inputModeRef.current) {
        enterInputModeRef.current();
      }
    });
    return () => { u1(); u2(); u3(); u4(); };
  }, [boundKeyboard]);

  // 通配符输入（通过 ref 读取 inputText，避免依赖）
  useEffect(() => {
    const u = boundKeyboard(["*"], (input: string) => {
      if (inputModeRef.current && input && input.length === 1) {
        setInputTextRef.current(inputTextRef.current + input);
      }
    });
    return () => u();
  }, [boundKeyboard]);

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