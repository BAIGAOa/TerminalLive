/**
 * The mailbox, as bytes.
 *
 * Letters are the only long-form text the game keeps, and they compress like
 * prose always does — a gzip on the way out is worth several kilobytes per
 * letter for no cost worth measuring. The file is therefore binary, and this
 * module is the only place that knows that.
 *
 * Decoding is strict: the bytes are validated back into a mailbox (through the
 * same schema that guards them) so a truncated or hand-edited file fails here,
 * loudly, rather than producing a half-built box somewhere downstream.
 */

import { gunzipSync, gzipSync } from "node:zlib";
import { mailboxFileSchema } from "./mailSchema.js";
import type { Mailbox } from "./mailbox.js";

/** Serialise a mailbox into the bytes that go on disk. */
export function encodeMailbox(box: Mailbox): Buffer {
  return gzipSync(Buffer.from(JSON.stringify({ box }), "utf8"));
}

/**
 * Read a mailbox back out. Throws when the bytes are not a mailbox — the
 * caller is expected to turn that into "there is no mailbox", not a crash.
 */
export function decodeMailbox(raw: Buffer): Mailbox {
  const text = gunzipSync(raw).toString("utf8");
  return mailboxFileSchema.parse(JSON.parse(text)).box as Mailbox;
}
