import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text } from "ink";
import { useKeyboard } from "ink-cartridge";
import {
  ConsoleNotification,
  ConsoleCommandResult,
} from "../core/console/ConsoleStore.js";
import { useControlConsole } from "../hooks/useControlConsole.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { useTerminalSize } from "./TerminalSizeContext.js";
import { computeConsoleLayout } from "./consoleLayout.js";
import { ModalFrame, ScrollPanel, TextField } from "./kit/index.js";

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

/** Desired panel height; ModalFrame clamps it to the terminal. */
const DESIRED_H = 24;

export default function ControlConsole({ onClose }: { onClose: () => void }) {
  const data = useControlConsole();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { rows } = useTerminalSize();

  // Size the inner layout to exactly fill the frame ModalFrame will render.
  const { notifH, gap, compH, resultsH } = computeConsoleLayout({
    rows,
    desiredH: DESIRED_H,
    notifications: data.notifications.length,
    completions: data.completions.length,
    inputMode: data.inputMode,
  });

  // The store keeps results newest-first; show them chronologically (like a
  // terminal) so multi-line command output reads top-to-bottom.
  const lines = useMemo<React.ReactNode[]>(
    () =>
      data.commandResults.length === 0
        ? [<Text key="__empty" dimColor>{data.t("console.noResults")}</Text>]
        : [...data.commandResults]
            .reverse()
            .map((r) => <CommandResultItem key={r.id} result={r} t={data.t} />),
    [data.commandResults, data.t],
  );

  const maxOffset = Math.max(0, lines.length - resultsH);
  const [offset, setOffset] = useState(0);
  const [follow, setFollow] = useState(true);

  // Keep the newest line in view unless the user has scrolled up.
  useEffect(() => {
    if (follow) setOffset(maxOffset);
  }, [follow, maxOffset, lines.length]);

  const scrollTo = useCallback(
    (next: number) => {
      const v = Math.max(0, Math.min(maxOffset, next));
      setOffset(v);
      setFollow(v >= maxOffset);
    },
    [maxOffset],
  );

  // Scroll the output — only when not typing (↑/↓ are history in input mode).
  useEffect(() => {
    if (data.inputMode) return;
    const page = Math.max(1, resultsH - 1);
    const unbinds = [
      boundKeyboard(["up"], () => scrollTo(offset - 1)),
      boundKeyboard(["down"], () => scrollTo(offset + 1)),
      boundKeyboard(["pageup"], () => scrollTo(offset - page)),
      boundKeyboard(["pagedown"], () => scrollTo(offset + page)),
      boundKeyboard(["home"], () => scrollTo(0)),
      boundKeyboard(["end"], () => scrollTo(maxOffset)),
    ];
    return () => unbinds.forEach((u) => u());
  }, [boundKeyboard, data.inputMode, offset, resultsH, maxOffset, scrollTo]);

  useEffect(() => {
    // Esc leaves input mode first (matching the hint), then closes the console.
    const uEsc = boundKeyboard(["escape"], () => {
      if (data.inputMode) data.exitInputMode();
      else onClose();
    });
    const uTab = boundKeyboard(["tab"], () => {
      if (!data.inputMode) data.enterInputMode();
      else data.acceptCompletion();
    });
    // ↑/↓ walk command history only while typing; otherwise they scroll output
    // (see the scroll effect above), so don't bind them twice.
    const unbinds = [uEsc, uTab];
    if (data.inputMode) {
      unbinds.push(
        boundKeyboard(["up"], () => data.historyPrev()),
        boundKeyboard(["down"], () => data.historyNext()),
      );
    }
    return () => unbinds.forEach((u) => u());
  }, [
    boundKeyboard,
    onClose,
    data.inputMode,
    data.enterInputMode,
    data.exitInputMode,
    data.acceptCompletion,
    data.historyPrev,
    data.historyNext,
  ]);

  return (
    <ModalFrame
      width={76}
      height={DESIRED_H}
      title={data.t("console.title")}
      borderColor={colors.consoleBorder}
      draggable
    >
      <Box flexDirection="column" flexGrow={1}>
        <Box justifyContent="flex-end">
          <Text dimColor wrap="truncate">
            {data.inputMode
              ? "[Tab] " +
                data.t("console.complete") +
                "  [↑↓] " +
                data.t("console.history") +
                "  [Esc] " +
                data.t("console.exitInputMode")
              : "[↑↓ PgUp/PgDn] " +
                data.t("console.scroll") +
                "  [Tab] " +
                data.t("console.enterInputMode") +
                "  [Esc] " +
                data.t("console.close")}
          </Text>
        </Box>

        {notifH > 0 ? (
          <Box flexDirection="column">
            {data.notifications
              .slice(0, notifH)
              .map((n) => (
                <NotificationItem key={n.id} notification={n} t={data.t} colors={colors} />
              ))}
          </Box>
        ) : null}

        <Box marginTop={gap}>
          <Text color={colors.muted}>── {data.t("console.results")} ────────────</Text>
        </Box>

        <ScrollPanel
          height={resultsH}
          lines={lines}
          offset={offset}
          onOffsetChange={scrollTo}
        />

        {compH > 0 ? (
          <Box flexDirection="column">
            {data.completions.slice(0, compH).map((candidate, i) => (
              <Text
                key={candidate}
                color={i === 0 ? colors.success : colors.muted}
                dimColor={i !== 0}
              >
                {i === 0 ? "▸ " : "  "}
                {candidate}
              </Text>
            ))}
          </Box>
        ) : null}

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
