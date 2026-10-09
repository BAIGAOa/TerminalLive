import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useWindowSize } from "ink";
import { useKeyboard } from "ink-cartridge";
import {
  ConsoleNotification,
  ConsoleCommandResult,
} from "../core/console/ConsoleStore.js";
import { useControlConsole } from "../hooks/useControlConsole.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { completionWindow, computeConsoleLayout } from "./consoleLayout.js";
import { wrapLine } from "./textWrap.js";
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

/**
 * Resolved text and theme colour for one console result. A plain function —
 * the caller wraps the text into rows, so this cannot be a component.
 */
function resultText(
  result: ConsoleCommandResult,
  t: (key: string, params?: Record<string, string | number>) => string,
  colors: ReturnType<typeof useThemeColors>,
): { text: string; color: string } {
  return {
    text: result.messageKey
      ? t(result.messageKey, result.messageParams as Record<string, string | number>)
      : (result.message ?? ""),
    color:
      result.type === "success"
        ? colors.success
        : result.type === "error"
          ? colors.error
          : colors.info,
  };
}

/** Desired panel size; ModalFrame clamps both axes to the terminal. */
const DESIRED_W = 76;
const DESIRED_H = 24;

export default function ControlConsole({ onClose }: { onClose: () => void }) {
  const data = useControlConsole();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { rows, columns } = useWindowSize();

  // Size the inner layout to exactly fill the frame ModalFrame will render.
  const { notifH, gap, compH, descH, resultsH, resultsW } =
    computeConsoleLayout({
      rows,
      columns,
      desiredH: DESIRED_H,
      desiredW: DESIRED_W,
      notifications: data.notifications.length,
      completions: data.completions.length,
      inputMode: data.inputMode,
      description: data.description,
    });

  const hasCompletions = data.completions.length > 0;
  // The menu scrolls with the highlight instead of growing past compH rows.
  const completionStart = completionWindow(
    data.completionIndex,
    data.completions.length,
    compH,
  );

  // The store keeps results newest-first and each entry may be longer than the
  // viewport is wide. Show them chronologically (like a terminal), pre-wrapped
  // into physical rows: the panel scrolls by row, so a soft-wrapped line has to
  // be its own rows rather than one tall entry.
  const lines = useMemo<React.ReactNode[]>(() => {
    if (data.commandResults.length === 0) {
      return [<Text key="__empty" dimColor>{data.t("console.noResults")}</Text>];
    }
    return [...data.commandResults].reverse().flatMap((r) => {
      const { text, color } = resultText(r, data.t, colors);
      return wrapLine(text, resultsW).map((row, i) => (
        <Text key={`${r.id}-${i}`} color={color} wrap="truncate">
          {row}
        </Text>
      ));
    });
  }, [data.commandResults, data.t, colors, resultsW]);

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
    // ↑/↓ belong to whatever is on screen: the completion menu while it has
    // entries, the command history otherwise. Outside input mode they scroll
    // the output (see the scroll effect above), so don't bind them twice.
    const unbinds = [uEsc, uTab];
    if (data.inputMode) {
      const up = hasCompletions ? data.completionPrev : data.historyPrev;
      const down = hasCompletions ? data.completionNext : data.historyNext;
      unbinds.push(
        boundKeyboard(["up"], () => up()),
        boundKeyboard(["down"], () => down()),
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
    hasCompletions,
    data.completionPrev,
    data.completionNext,
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
                // ↑/↓ drive the completion menu when there is one to drive.
                data.t(hasCompletions ? "console.select" : "console.history") +
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
            {data.completions
              .slice(completionStart, completionStart + compH)
              .map((candidate, i) => {
                const index = completionStart + i;
                const selected = index === data.completionIndex;
                return (
                  <Text
                    key={candidate}
                    color={selected ? colors.success : colors.muted}
                    dimColor={!selected}
                    wrap="truncate"
                  >
                    {selected ? "▸ " : "  "}
                    {candidate}
                  </Text>
                );
              })}
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
                onSubmit={data.submitOrComplete}
                focusId="console-input"
                caret="terminal"
              />
            </>
          ) : (
            <Text dimColor>{data.t("console.inputHint")}</Text>
          )}
        </Box>

        {/* Help for the command being typed (or the highlighted completion),
            pinned right under the input line. */}
        {descH > 0 && data.description ? (
          <Box flexDirection="column">
            {data.description.usage ? (
              <Text color={colors.info} wrap="truncate">
                {data.description.usage}
              </Text>
            ) : null}
            <Text color={colors.muted} wrap="truncate">
              {data.description.summary}
            </Text>
          </Box>
        ) : null}
      </Box>
    </ModalFrame>
  );
}
