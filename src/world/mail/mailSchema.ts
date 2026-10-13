/**
 * The persisted shape of the mailbox.
 *
 * The letters live in their own file (`MailStore`), not in the auto-save blob,
 * so the schema that guards them belongs here with the rest of the mail system
 * rather than in `core/archive/SaveSchema`. The save schema still imports it,
 * but only to read the `mail` field that pre-split saves carry.
 */

import z from "zod";
import type { Mailbox } from "./mailbox.js";

export const letterSchema = z.object({
  id: z.string(),
  npcId: z.string(),
  year: z.number(),
  subject: z.string(),
  body: z.string(),
  choices: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        affinity: z.number(),
      }),
    )
    .default([]),
  status: z.enum(["unread", "read", "answered"]).default("unread"),
  /** How far into the exchange this letter is; 0 = the NPC began it. */
  depth: z.number().default(0),
  reply: z.string().optional(),
  chosen: z.string().optional(),
});

export const mailboxSchema = z.object({
  letters: z.array(letterSchema).default([]),
  cooldowns: z.record(z.string(), z.number()).default({}),
  countedYear: z.number().default(-1),
  sentThisYear: z.number().default(0),
  lastDecisionYear: z.number().default(-1),
  replyYear: z.number().default(-1),
  repliesThisYear: z.number().default(0),
});

/** What the mailbox file holds — an envelope, so the format can grow. */
export const mailboxFileSchema = z.object({
  box: mailboxSchema,
});

export type MailboxFile = { box: Mailbox };
