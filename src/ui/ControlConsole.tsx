import React from "react";
import { Box, Text } from "ink";
import { ConsoleNotification } from "../core/console/ConsoleStore.js";
import { useControlConsole } from "../hooks/useControlConsole.js";
import { useKeyboardHandler } from "../hooks/key/useKeyBoardHandle.js";
import { ConsoleCommandResult } from "../core/console/ConsoleStore.js";

/** 通知条目 */
const NotificationItem = ({
  notification,
  t,
}: {
  notification: ConsoleNotification;
  t: (key: string, params?: Record<string, string | number>) => string;
}) => {
  switch (notification.type) {
    case "achievement":
      return (
        <Text color="green">
          ★ {t("achievement.unlock")} {t(notification.messageKey)}
        </Text>
      );
    case "mod":
      return (
        <Text color="red">
          [mod]{" "}
          {t("mod.message.loadSuccess", { modName: notification.messageKey })}
        </Text>
      );
    case "archive":
      return (
        <Text bold color="magentaBright">
          [archive]{" "}
          {t("archive.message.loadFailed", { levelId: notification.messageKey })}
        </Text>
      );
    case "catalogCreation":
      return (
        <Text bold color="cyan">
          [archive]{" "}
          {t("archive.message.createFailed", { id: notification.messageKey })}
        </Text>
      );
    default:
      return <Text>{t(notification.messageKey)}</Text>;
  }
};


/** 指令结果条目 */
const CommandResultItem = ({
  result,
  t,
}: {
  result: ConsoleCommandResult;
  t: (key: string, params?: Record<string, string | number>) => string;
}) => {
  const color =
    result.type === "success"
      ? "green"
      : result.type === "error"
        ? "red"
        : "cyan";

  // 优先使用 i18n key，回退到原始 message
  const text = result.messageKey
    ? t(result.messageKey, result.messageParams as Record<string, string | number>)
    : (result.message ?? "");

  return <Text color={color}>{text}</Text>;
};

export default function ControlConsole() {
  const data = useControlConsole();

  // 键盘处理：输入模式下全拦截，非输入模式下只拦截 Tab
  useKeyboardHandler(
    (input, key) => {
      if (data.inputMode) {
        // 输入模式：拦截所有按键
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
        // 过滤控制字符，仅接受可打印单字符
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
        // 拦截所有其他按键（方向键、功能键等）
        return true;
      } else {
        // 非输入模式：只拦截 Tab 用于进入输入模式
        if (key.tab) {
          data.enterInputMode();
          return true;
        }
        return false; // 放行其他按键
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
      borderColor="redBright"
      width="100%"
      height={16}
      paddingX={1}
      backgroundColor="black"
    >
      {/* 标题栏 */}
      <Box justifyContent="space-between">
        <Text color="red" bold>
          {data.t("console.title")}
        </Text>
        <Text dimColor>
          {data.inputMode
            ? "[Esc] " + data.t("console.exitInputMode")
            : "[Tab] " + data.t("console.enterInputMode") +
            "  [P] " + data.t("console.close")}
        </Text>
      </Box>

      {/* 通知区 */}
      <Box flexDirection="column" marginTop={1}>
        {data.notifications.length === 0 ? (
          <Text dimColor>{data.t("console.empty")}</Text>
        ) : (
          data.notifications.slice(0, 4).map((n) => (
            <NotificationItem key={n.id} notification={n} t={data.t} />
          ))
        )}
      </Box>

      {/* 分隔线 */}
      <Box marginY={1}>
        <Text color="gray">── {data.t("console.results")} ────────────</Text>
      </Box>

      {/* 指令执行结果区 */}
      <Box flexDirection="column" flexGrow={1}>
        {data.commandResults.length === 0 ? (
          <Text dimColor>{data.t("console.noResults")}</Text>
        ) : (
          data.commandResults
            .slice(0, 5)
            .map((r) => <CommandResultItem key={r.id} result={r} t={data.t} />)
        )}
      </Box>

      {/* 输入区 */}
      <Box marginTop={1} flexDirection="row">
        {data.inputMode ? (
          <>
            <Text color="yellow" bold>
              {"▶ "}
            </Text>
            <Text>{data.inputText}</Text>
            <Text color="gray">█</Text>
          </>
        ) : (
          <Text dimColor>
            {data.t("console.inputHint")}
          </Text>
        )}
      </Box>
    </Box>
  );
}
