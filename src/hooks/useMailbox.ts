import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { container } from "../Container.js";
import { useI18n } from "../core/language/LanguageContext.js";
import WorldManager from "../worlds/WorldManager.js";
import NpcRegistry from "../world/relationships/NpcRegistry.js";
import MailService from "../world/mail/MailService.js";
import { sortedLetters, unreadCount, type Mailbox } from "../world/mail/mailbox.js";
import type { Letter } from "../world/mail/letter.js";

/** One row of the inbox. */
export interface MailItem {
  id: string;
  /** Who wrote it, resolved to the player's language. */
  from: string;
  npcId: string;
  year: number;
  subject: string;
  unread: boolean;
  answered: boolean;
  /** A letter that put a question to the player. */
  demandsAnswer: boolean;
}

export interface MailboxView {
  items: MailItem[];
  unread: number;
  total: number;
  /** The letter currently open, if any. */
  open: Letter | null;
  /** The open letter's author, resolved. */
  openFrom: string;
  openItems: Array<{ value: string; label: string }>;
  reply: string;
  setReply: (next: string) => void;
  openLetter: (id: string) => void;
  closeLetter: () => void;
  choose: (choiceId: string) => void;
  sendReply: () => void;
}

/**
 * The mailbox as the UI needs it: plain rows, plain strings, and the handful of
 * actions the panel offers. Everything the model wrote is already validated by
 * the time it reaches here — this hook only resolves names and marks reads.
 */
export function useMailbox(): MailboxView {
  const { t } = useI18n();
  const mail = container.resolve(MailService);
  const npcs = container.resolve(NpcRegistry);

  useSyncExternalStore(mail.subscribe, mail.getSnapshot);

  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const box: Mailbox = mail.getBox();

  const nameOf = useCallback(
    (npcId: string): string => {
      const npc = npcs.get(npcId);
      return npc ? t(npc.labelKey) : npcId;
    },
    [npcs, t],
  );

  const items: MailItem[] = useMemo(
    () =>
      sortedLetters(box).map((l) => ({
        id: l.id,
        npcId: l.npcId,
        from: nameOf(l.npcId),
        year: l.year,
        subject: l.subject,
        unread: l.status === "unread",
        answered: l.status === "answered",
        demandsAnswer: l.choices.length > 0 && l.chosen === undefined,
      })),
    [box, nameOf],
  );

  const open = openId
    ? (box.letters.find((l) => l.id === openId) ?? null)
    : null;

  const openLetter = useCallback(
    (id: string) => {
      mail.read(id);
      setReply("");
      setOpenId(id);
    },
    [mail],
  );

  const closeLetter = useCallback(() => setOpenId(null), []);

  // The inbox is only reachable in-game, but a throw here would take the whole
  // TUI down, so a missing life degrades to "you cannot answer yet".
  const player = (() => {
    try {
      return container.resolve(WorldManager).getPlayer();
    } catch {
      return null;
    }
  })();

  const choose = useCallback(
    (choiceId: string) => {
      if (!openId || !player) return;
      mail.answer(player, openId, reply.trim() || undefined, choiceId);
      setReply("");
      setOpenId(null);
    },
    [mail, player, openId, reply],
  );

  const sendReply = useCallback(() => {
    if (!openId || !player || !reply.trim()) return;
    mail.answer(player, openId, reply.trim(), undefined);
    setReply("");
    setOpenId(null);
  }, [mail, player, openId, reply]);

  return {
    items,
    unread: unreadCount(box),
    total: box.letters.length,
    open,
    openFrom: open ? nameOf(open.npcId) : "",
    openItems: (open?.choices ?? []).map((c) => ({ value: c.id, label: c.label })),
    reply,
    setReply,
    openLetter,
    closeLetter,
    choose,
    sendReply,
  };
}
