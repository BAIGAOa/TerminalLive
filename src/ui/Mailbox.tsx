import React, { useEffect, useMemo } from "react";
import { Box, Text, useWindowSize } from "ink";
import { useKeyboard } from "ink-cartridge";
import { useI18n } from "../core/language/LanguageContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { useMailbox } from "../hooks/useMailbox.js";
import { MenuList, ModalFrame, TextArea, clampHeight, clampWidth } from "./kit/index.js";
import { MailBody, mailBodyTextWidth } from "./MailBody.js";
import { wrapLine } from "./textWrap.js";
import { dismissModal } from "./layers/modalBus.js";
import { MAILBOX_MODAL_ID } from "./layers/layerIds.js";

/** Frame borders (2) + paddingX (4). */
const FRAME_CHROME = 6;
/** Rows the frame spends on borders, padding and the title block. */
const FRAME_ROWS = 6;
/** Rows the footer hints take under the list. */
const LIST_FOOTER = 2;

/**
 * The inbox — `g e`.
 *
 * Everything the AI characters send arrives here and is answered one letter at
 * a time. Two views, never both: the list, and the letter you opened. Keeping
 * it sequential is what makes "reply to several people in one year" legible in
 * a terminal instead of a three-pane mess.
 */
export default function Mailbox() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { columns, rows } = useWindowSize();
  const mail = useMailbox();

  const width = clampWidth(columns, 84);
  const height = clampHeight(rows, 24);

  const { open, closeLetter } = mail;
  useEffect(() => {
    const u = boundKeyboard(["escape"], () => {
      // One level at a time: a letter closes back to the list, the list closes
      // the mailbox. A modal layer owns the keyboard, so there must be a way out.
      if (open) closeLetter();
      else dismissModal(MAILBOX_MODAL_ID);
    });
    return () => u();
  }, [boundKeyboard, open, closeLetter]);

  const title = `${t("mail.title")}   ${t("mail.unread", {
    n: mail.unread,
    total: mail.total,
  })}`;

  return (
    <ModalFrame width={width} height={height} title={title} borderColor="white">
      {mail.open ? (
        <LetterView
          mail={mail}
          panelWidth={Math.max(20, width - FRAME_CHROME)}
          panelHeight={height}
        />
      ) : (
        <ListView
          mail={mail}
          colors={colors}
          t={t}
          listHeight={Math.max(4, height - FRAME_ROWS - LIST_FOOTER)}
        />
      )}
    </ModalFrame>
  );
}

type View = ReturnType<typeof useMailbox>;
type Colors = ReturnType<typeof useThemeColors>;
type T = (key: string, params?: Record<string, string | number>) => string;

function ListView({
  mail,
  colors,
  t,
  listHeight,
}: {
  mail: View;
  colors: Colors;
  t: T;
  listHeight: number;
}) {
  const { focusSet } = useKeyboard();

  // Switching between the list and a letter happens inside one modal layer, so
  // the engine does not move focus for us: when the list comes back, it has to
  // take the keyboard again or its arrow keys go dead.
  useEffect(() => {
    try {
      focusSet("mail-list");
    } catch {
      /* not registered yet — auto-focus will cover it */
    }
  }, [focusSet]);

  if (mail.items.length === 0) {
    return (
      <Box flexDirection="column" alignItems="center" marginTop={2}>
        <Text dimColor>{t("mail.empty")}</Text>
        <Box marginTop={1}>
          <Text dimColor>{t("mail.empty.hint")}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <MenuList
        items={mail.items.map((m) => ({
          value: m.id,
          label: `${m.unread ? "●" : " "} ${m.subject}  —  ${m.from}`,
        }))}
        focusId="mail-list"
        wrap={false}
        // The marker is drawn by renderItem below; MenuList's own would be a
        // second arrow on every row.
        indicator={null}
        // Bounded by the frame: a full box scrolls rather than spilling out of
        // the modal, which does not clip its children.
        height={Math.min(mail.items.length, listHeight)}
        onSelect={(item) => mail.openLetter(item.value)}
        renderItem={(item, state) => {
          const row = mail.items.find((m) => m.id === item.value);
          if (!row) return null;
          const active = state.focused && state.selected;
          return (
            <Box flexDirection="row" flexGrow={1} justifyContent="space-between">
              <Text
                wrap="truncate"
                bold={active}
                color={row.unread ? colors.text : colors.muted}
              >
                {active ? "❯ " : "  "}
                {row.unread ? "●" : "○"} {row.subject}
              </Text>
              <Text dimColor wrap="truncate">
                {row.from}
                {row.demandsAnswer ? `  ${t("mail.badge.decision")}` : ""}
                {row.answered ? `  ${t("mail.badge.answered")}` : ""}
              </Text>
            </Box>
          );
        }}
      />
      <Box marginTop={1} flexDirection="column" alignItems="center">
        <Text dimColor>{t("mail.hint.list")}</Text>
      </Box>
    </Box>
  );
}

function LetterView({
  mail,
  panelWidth,
  panelHeight,
}: {
  mail: View;
  panelWidth: number;
  /** Rows the frame has, so the body is sized to the frame rather than to the
   *  terminal — the frame does not clip, and a body taller than its box would
   *  be drawn over everything below it. */
  panelHeight: number;
}) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { focusSet } = useKeyboard();
  const letter = mail.open!;
  const choiceCount = letter.choices.length;

  // A letter that asks something hands the keyboard to its options; one that
  // does not hands it to the reply field, which focuses itself. Without this
  // the option list would render but never react to the arrow keys.
  useEffect(() => {
    if (choiceCount === 0) return;
    try {
      focusSet("mail-choices");
    } catch {
      /* not registered yet */
    }
  }, [focusSet, letter.id, choiceCount]);

  // Everything under the body: the header lines, and whichever block this
  // letter ends with. The indicator row is paid for out of the body's budget
  // below, so adding it can never push the content past the frame.
  const headerRows = 2;
  const actionRows =
    choiceCount > 0
      ? choiceCount + 4
      : letter.status === "answered"
        ? 4
        : 7;

  const bodyRows = useMemo(
    () => wrapLine(letter.body, mailBodyTextWidth(panelWidth)).length,
    [letter.body, panelWidth],
  );
  const maxBodyRows = Math.max(
    1,
    panelHeight - FRAME_ROWS - headerRows - actionRows,
  );
  let bodyHeight = Math.max(1, Math.min(14, bodyRows, maxBodyRows));
  const overflows = bodyRows > bodyHeight;
  if (overflows) bodyHeight = Math.max(1, bodyHeight - 1);

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={colors.info} wrap="truncate">
          {mail.openFrom}
        </Text>
        <Text dimColor>{t("mail.year", { n: letter.year })}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color={colors.warning} wrap="truncate">
          {letter.subject}
        </Text>
      </Box>

      <MailBody body={letter.body} width={panelWidth} height={bodyHeight} />

      {letter.choices.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>{t("mail.decision")}</Text>
          <MenuList
            items={mail.openItems}
            focusId="mail-choices"
            wrap={false}
            // The arrow is drawn by renderItem; MenuList's own would double it.
            indicator={null}
            onSelect={(item) => mail.choose(item.value)}
            renderItem={(item, state) => {
              const active = state.focused && state.selected;
              return (
                <Text bold={active} color={active ? colors.success : colors.text} wrap="truncate">
                  {active ? "❯ " : "  "}
                  {item.label}
                </Text>
              );
            }}
          />
          <Box marginTop={1}>
            <Text dimColor>{t("mail.hint.choose")}</Text>
          </Box>
        </Box>
      ) : letter.status === "answered" ? (
        <Box marginTop={1} flexDirection="column">
          <Text color={colors.success}>{t("mail.answered")}</Text>
          {letter.reply ? (
            <Text dimColor wrap="truncate">{`“${letter.reply}”`}</Text>
          ) : null}
          <Text dimColor>{t("mail.hint.back")}</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>{t("mail.replyTo", { name: mail.openFrom })}</Text>
          <Box flexDirection="row">
            <Text color={colors.info}>{"› "}</Text>
            <TextArea
              value={mail.reply}
              onChange={mail.setReply}
              onSubmit={mail.sendReply}
              focusId="mail-reply"
              placeholder={t("mail.reply.placeholder")}
              width={64}
              height={3}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>{t("mail.hint.reply")}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
