import React, { useEffect, useMemo, useState } from "react";
import { Box, Text } from "ink";
import { useKeyboard } from "ink-cartridge";
import { useI18n } from "../core/language/LanguageContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { ScrollPanel } from "./kit/ScrollPanel.js";
import { wrapLine } from "./textWrap.js";

/** The scrollbar's margin plus its column — reserved whether or not it shows. */
const BAR_CHROME = 2;

/**
 * Cells the body's text may occupy inside a panel of `panelWidth` columns.
 *
 * Exported so a caller that has to size the panel *before* rendering it — the
 * decision popup, which grows to fit its letter — wraps at exactly the same
 * width and so predicts the same number of rows.
 */
export function mailBodyTextWidth(panelWidth: number): number {
  return Math.max(8, panelWidth - BAR_CHROME);
}

/**
 * A letter's body, wrapped and scrollable.
 *
 * Two things this exists to get right, both of which were wrong when the body
 * was handed to `ScrollPanel` directly:
 *
 * 1. **Wrapping happens here.** `ScrollPanel` puts each entry it is given into a
 *    one-row box that clips what does not fit, so a paragraph passed in whole is
 *    cut off at the panel edge instead of continuing on the next line. The
 *    console pre-wraps for the same reason.
 * 2. **The keyboard can reach the end of it.** The panel is driven by a
 *    controlled offset and PageUp/PageDown are bound here, rather than handing
 *    the panel a `focusId` — that would make it claim the arrow keys, which the
 *    option list below needs.
 *
 * `width` is the columns available to the whole panel; the scrollbar's cells are
 * reserved from it either way, so the text never re-flows when the bar appears.
 */
export function MailBody({
  body,
  width,
  height,
}: {
  body: string;
  /** Columns available, including where the scrollbar goes. */
  width: number;
  /** Visible rows. */
  height: number;
}) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const [offset, setOffset] = useState(0);

  const textWidth = mailBodyTextWidth(width);
  const lines = useMemo(
    () =>
      wrapLine(body, textWidth).map((row, i) => (
        <Text key={i} wrap="truncate" color={colors.text}>
          {row || " "}
        </Text>
      )),
    [body, textWidth, colors.text],
  );

  const maxOffset = Math.max(0, lines.length - height);
  const overflow = maxOffset > 0;
  const clamped = Math.min(offset, maxOffset);

  // A new letter starts at its first line, not wherever the last one was left.
  useEffect(() => {
    setOffset(0);
  }, [body]);

  useEffect(() => {
    if (!overflow) return;
    const page = Math.max(1, height - 1);
    const down = boundKeyboard(["pagedown"], () =>
      setOffset((o) => Math.min(maxOffset, o + page)),
    );
    const up = boundKeyboard(["pageup"], () =>
      setOffset((o) => Math.max(0, o - page)),
    );
    return () => {
      down();
      up();
    };
  }, [boundKeyboard, overflow, maxOffset, height]);

  return (
    <Box flexDirection="column">
      <ScrollPanel
        lines={lines}
        height={height}
        offset={clamped}
        onOffsetChange={setOffset}
        showBar={overflow}
      />
      {overflow ? (
        <Text dimColor wrap="truncate">
          {t("mail.scrollHint", {
            from: clamped + 1,
            to: Math.min(lines.length, clamped + height),
            total: lines.length,
          })}
        </Text>
      ) : null}
    </Box>
  );
}
