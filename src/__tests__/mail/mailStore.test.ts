import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import MailStore, {
  MAIL_FILENAME,
  resolveMailPath,
} from "../../world/mail/MailStore.js";
import { emptyMailbox } from "../../world/mail/mailbox.js";
import type { Letter } from "../../world/mail/letter.js";

const FALLBACK = "/repo/resource/mail.json.gz";

describe("resolveMailPath", () => {
  it("falls back to the shipped path when nothing is configured", () => {
    expect(resolveMailPath({}, FALLBACK)).toEqual({
      path: FALLBACK,
      enabled: true,
    });
  });

  it("uses an explicit TL_MAIL path", () => {
    expect(resolveMailPath({ TL_MAIL: "/tmp/here.json.gz" }, FALLBACK)).toEqual({
      path: "/tmp/here.json.gz",
      enabled: true,
    });
  });

  it("is disabled by TL_MAIL=off", () => {
    expect(resolveMailPath({ TL_MAIL: "off" }, FALLBACK)).toEqual({
      path: FALLBACK,
      enabled: false,
    });
  });

  it("is disabled by TL_AUTOSAVE=off — a run that keeps nothing keeps no letters", () => {
    expect(resolveMailPath({ TL_AUTOSAVE: "off" }, FALLBACK).enabled).toBe(false);
  });

  it("sits beside the auto-save slot when TL_AUTOSAVE names a file", () => {
    // A harness that redirects the save to a temp dir must not get its letters
    // written into the repository's resource/ directory.
    const resolved = resolveMailPath({ TL_AUTOSAVE: "/tmp/tl-run/life.json" }, FALLBACK);
    expect(resolved).toEqual({
      path: join("/tmp/tl-run", MAIL_FILENAME),
      enabled: true,
    });
  });

  it("lets TL_MAIL override an auto-save path", () => {
    const resolved = resolveMailPath(
      { TL_AUTOSAVE: "/tmp/tl-run/life.json", TL_MAIL: "/tmp/explicit.json.gz" },
      FALLBACK,
    );
    expect(resolved.path).toBe("/tmp/explicit.json.gz");
  });

  it("lets TL_MAIL=off win over a configured auto-save path", () => {
    const resolved = resolveMailPath(
      { TL_AUTOSAVE: "/tmp/tl-run/life.json", TL_MAIL: "off" },
      FALLBACK,
    );
    expect(resolved.enabled).toBe(false);
  });
});

describe("MailStore", () => {
  const dirs: string[] = [];
  const savedEnv = {
    TL_MAIL: process.env.TL_MAIL,
    TL_AUTOSAVE: process.env.TL_AUTOSAVE,
  };

  function tmpDir(): string {
    const d = mkdtempSync(join(tmpdir(), "tl-mail-"));
    dirs.push(d);
    return d;
  }

  function storeAt(path: string): MailStore {
    process.env.TL_MAIL = path;
    return new MailStore();
  }

  beforeEach(() => {
    delete process.env.TL_MAIL;
    delete process.env.TL_AUTOSAVE;
  });

  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("reports no mailbox when the file has never been written", () => {
    const store = storeAt(join(tmpDir(), "mail.json.gz"));
    expect(store.exists()).toBe(false);
    expect(store.read()).toBeNull();
  });

  it("round-trips a mailbox through the file", () => {
    const store = storeAt(join(tmpDir(), "mail.json.gz"));
    const letter: Letter = {
      id: "m1",
      npcId: "npc_a",
      year: 30,
      subject: "你好",
      body: "好久没见了。",
      choices: [],
      status: "unread",
      depth: 0,
    };
    const box = { ...emptyMailbox(), letters: [letter] };

    store.write(box);

    expect(store.exists()).toBe(true);
    expect(store.read()).toEqual(box);
  });

  it("replaces a previous mailbox rather than appending to it", () => {
    const store = storeAt(join(tmpDir(), "mail.json.gz"));
    store.write({ ...emptyMailbox(), sentThisYear: 9 });
    store.write(emptyMailbox());
    expect(store.read()?.sentThisYear).toBe(0);
  });

  it("clears the file on demand", () => {
    const store = storeAt(join(tmpDir(), "mail.json.gz"));
    store.write(emptyMailbox());
    store.clear();
    expect(store.exists()).toBe(false);
    expect(store.read()).toBeNull();
  });

  it("clearing a mailbox that was never written is harmless", () => {
    const store = storeAt(join(tmpDir(), "mail.json.gz"));
    expect(() => store.clear()).not.toThrow();
  });

  it("treats a corrupt file as no mailbox, and keeps it", () => {
    const path = join(tmpDir(), "mail.json.gz");
    writeFileSync(path, "not a mailbox at all");

    const store = storeAt(path);
    expect(store.read()).toBeNull();
    // The bad bytes are left where they are: they are the only copy of those
    // letters, and a failed read must not destroy them.
    expect(existsSync(path)).toBe(true);
  });

  it("writes nothing at all when persistence is disabled", () => {
    const path = join(tmpDir(), "mail.json.gz");
    process.env.TL_MAIL = "off";
    const store = new MailStore();

    expect(store.active).toBe(false);
    store.write(emptyMailbox());
    expect(existsSync(path)).toBe(false);
    expect(store.read()).toBeNull();
  });

  it("creates the directory the mailbox lives in", () => {
    const nested = join(tmpDir(), "deep", "deeper", "mail.json.gz");
    const store = storeAt(nested);
    store.write(emptyMailbox());
    expect(existsSync(nested)).toBe(true);
  });
});
