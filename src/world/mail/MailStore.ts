import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { atomicWriteBufferSync } from "../../core/archive/atomicWrite.js";
import { resourcePath } from "../../core/paths.js";
import { decodeMailbox, encodeMailbox } from "./mailCodec.js";
import type { Mailbox } from "./mailbox.js";

/** The mailbox file, next to the auto-save slot it belongs with. */
export const MAIL_FILENAME = "mail.json.gz";

export interface MailPath {
  path: string;
  enabled: boolean;
}

/**
 * Where the mailbox file lives, from the environment.
 *
 * Pure so the rules can be asserted without touching the real filesystem:
 *
 * - `TL_MAIL=off` — or `TL_AUTOSAVE=off`, which means "this run keeps nothing" —
 *   disables it entirely, so a headless harness leaves no file behind.
 * - `TL_MAIL=<path>` names the file outright.
 * - `TL_AUTOSAVE=<path>` puts the mailbox in that directory. A harness that
 *   redirects the auto-save to a temp dir therefore gets its letters there
 *   too, instead of scribbling into the repository's `resource/`.
 */
export function resolveMailPath(env: NodeJS.ProcessEnv, fallback: string): MailPath {
  const mail = env.TL_MAIL;
  const autoSave = env.TL_AUTOSAVE;
  if (mail === "off" || autoSave === "off") {
    return { path: fallback, enabled: false };
  }
  if (mail) return { path: mail, enabled: true };
  if (autoSave) return { path: join(dirname(autoSave), MAIL_FILENAME), enabled: true };
  return { path: fallback, enabled: true };
}

/**
 * The mailbox's own file.
 *
 * Kept apart from the auto-save blob on purpose. The letters are the only part
 * of a life that grows without bound, and the auto-save is written whenever the
 * player does anything — so leaving them in the blob meant re-serialising every
 * letter, many times a second, for a mailbox that changes a handful of times a
 * year. Here they are written only when the box actually changes, compressed.
 *
 * Reads are best-effort by design: a missing or unreadable file is "no
 * correspondence yet", never a failed boot.
 */
export default class MailStore {
  private readonly filePath: string;
  private readonly enabled: boolean;

  constructor() {
    const resolved = resolveMailPath(process.env, resourcePath(MAIL_FILENAME));
    this.filePath = resolved.path;
    this.enabled = resolved.enabled;
  }

  /** Path of the mailbox file (exposed for diagnostics and archive copy-out). */
  public get path(): string {
    return this.filePath;
  }

  /** Whether this run persists a mailbox at all. */
  public get active(): boolean {
    return this.enabled;
  }

  public exists(): boolean {
    return this.enabled && existsSync(this.filePath);
  }

  /** The stored mailbox, or null when there is none / it cannot be read. */
  public read(): Mailbox | null {
    if (!this.exists()) return null;
    try {
      return decodeMailbox(readFileSync(this.filePath));
    } catch (err) {
      // A corrupt mailbox must not cost the player their life: the letters are
      // dropped, the game goes on, and the bad file is left where it is.
      console.warn("[mail] 信箱存档损坏，已忽略:", (err as Error).message);
      return null;
    }
  }

  /** Replace the stored mailbox. A no-op when persistence is disabled. */
  public write(box: Mailbox): void {
    if (!this.enabled) return;
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      atomicWriteBufferSync(this.filePath, encodeMailbox(box));
    } catch (err) {
      console.warn("[mail] 写入信箱存档失败:", (err as Error).message);
    }
  }

  /** Forget the mailbox — a life ended, or a new one began. */
  public clear(): void {
    if (!this.enabled) return;
    try {
      if (existsSync(this.filePath)) rmSync(this.filePath, { force: true });
    } catch {
      /* best effort */
    }
  }
}
