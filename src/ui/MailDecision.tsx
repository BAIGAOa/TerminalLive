import React, { useEffect, useMemo } from "react";
import { Box, Text, useWindowSize } from "ink";
import { useKeyboard } from "ink-cartridge";
import { container } from "../Container.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { useMailbox } from "../hooks/useMailbox.js";
import MailService from "../world/mail/MailService.js";
import { MenuList, ModalFrame, clampHeight, clampWidth } from "./kit/index.js";
import { MailBody, mailBodyTextWidth } from "./MailBody.js";
import { wrapLine } from "./textWrap.js";
import { dismissModal } from "./layers/modalBus.js";
import { MAIL_DECISION_MODAL_ID } from "./layers/layerIds.js";

/** Desired popup width, before the terminal clamps it. */
const DECISION_WIDTH = 72;
/** Frame borders (2) + paddingX (4). */
const FRAME_CHROME = 6;
/** Borders (2) + paddingY (2) + the title block (2). */
const FRAME_ROWS = 6;
/** Label + the choice list + hints, below the body. */
const ACTION_ROWS = 4;

/**
 * The one popup a letter may raise.
 *
 * Only letters that actually put a question to the player get one, only one
 * exists at a time, and Esc defers it back to the inbox rather than nagging —
 * so an NPC demanding an answer can never hold the game hostage.
 *
 * The frame is sized to its letter: a popup that fixed its height would clip a
 * long message, and the player would have to go to the inbox to read a question
 * they are being asked right now.
 */
export default function MailDecision() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { columns, rows } = useWindowSize();
  const mail = useMailbox();
  const service = container.resolve(MailService);

  const letter = mail.open ?? null;
  const pending = letter && letter.choices.length > 0 ? letter : null;

  // Open the letter so the shared view-model has its body and choices in hand.
  useEffect(() => {
    const next = service.decision();
    if (next) mail.openLetter(next.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (pending) service.defer(pending.id);
    dismissModal(MAIL_DECISION_MODAL_ID);
  };

  useEffect(() => {
    const u = boundKeyboard(["escape"], close);
    return () => u();
    // `close` closes over the letter it defers, so it has to be rebuilt when
    // that letter changes — but not on every unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundKeyboard, pending?.id, service]);

  const width = clampWidth(columns, DECISION_WIDTH);
  const panelWidth = Math.max(20, width - FRAME_CHROME);
  const choiceCount = pending?.choices.length ?? 0;

  // The popup grows to fit the letter, up to what the terminal can hold. Both
  // the height and the wrap below use the same width, so the predicted row
  // count is the row count the body will actually draw.
  const bodyRows = useMemo(
    () => wrapLine(pending?.body ?? "", mailBodyTextWidth(panelWidth)).length,
    [pending?.body, panelWidth],
  );
  // Leave a two-row margin, exactly as `clampHeight` does, so the frame it
  // sizes is the frame the children fit into — the frame does not clip, so a
  // body taller than its box would be drawn straight over the terminal.
  const maxBodyRows = Math.max(
    1,
    rows - 2 - FRAME_ROWS - ACTION_ROWS - choiceCount,
  );
  let bodyHeight = Math.max(1, Math.min(bodyRows, maxBodyRows));
  const overflows = bodyRows > bodyHeight;
  // The "there is more" row is drawn from the body's own budget, so adding it
  // never pushes the frame past the terminal.
  if (overflows) bodyHeight = Math.max(1, bodyHeight - 1);
  const height = clampHeight(
    rows,
    FRAME_ROWS + bodyHeight + ACTION_ROWS + choiceCount + (overflows ? 1 : 0),
  );

  if (!pending) {
    return (
      <ModalFrame width={width} borderColor="white" title={t("mail.title")}>
        <Text dimColor>{t("mail.empty")}</Text>
      </ModalFrame>
    );
  }

  return (
    <ModalFrame
      width={width}
      height={height}
      borderColor={colors.warning}
      title={`${mail.openFrom} — ${pending.subject}`}
    >
      <Box flexDirection="column">
        <MailBody body={pending.body} width={panelWidth} height={bodyHeight} />
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>{t("mail.decision")}</Text>
          <MenuList
            items={mail.openItems}
            focusId="mail-decision-choices"
            wrap={false}
            // The arrow is drawn by renderItem; MenuList's own would double it.
            indicator={null}
            onSelect={(item) => {
              mail.choose(item.value);
              dismissModal(MAIL_DECISION_MODAL_ID);
            }}
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
        </Box>
        <Box marginTop={1} flexDirection="column" alignItems="center">
          <Text dimColor>{t("mail.hint.decision")}</Text>
        </Box>
      </Box>
    </ModalFrame>
  );
}
