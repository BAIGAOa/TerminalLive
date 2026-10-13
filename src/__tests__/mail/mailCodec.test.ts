import { describe, it, expect } from "vitest";
import { gzipSync } from "node:zlib";
import { decodeMailbox, encodeMailbox } from "../../world/mail/mailCodec.js";
import { emptyMailbox, type Mailbox } from "../../world/mail/mailbox.js";
import type { Letter } from "../../world/mail/letter.js";

function fullBox(): Mailbox {
  const letters: Letter[] = [
    {
      id: "mail-34-npc_boss-2",
      npcId: "npc_boss",
      year: 34,
      subject: "关于那份报告",
      body: "你上周交的东西我看了。\n有几个地方要重做，明天早上来找我。",
      choices: [
        { id: "c1", label: "接受，重做一份", affinity: 4 },
        { id: "c2", label: "拒绝，据理力争", affinity: -6 },
      ],
      status: "answered",
      depth: 1,
      reply: "我今晚就改。",
      chosen: "c1",
    },
    {
      id: "mail-33-npc_friend-1",
      npcId: "npc_friend",
      year: 33,
      subject: "好久不见",
      body: "听说你换工作了。",
      choices: [],
      status: "unread",
      depth: 0,
    },
  ];
  return {
    ...emptyMailbox(),
    letters,
    cooldowns: { npc_boss: 36, npc_friend: 35 },
    countedYear: 34,
    sentThisYear: 2,
    lastDecisionYear: 34,
    replyYear: 34,
    repliesThisYear: 1,
  };
}

describe("encodeMailbox / decodeMailbox", () => {
  it("round-trips a full mailbox byte for byte", () => {
    const box = fullBox();
    expect(decodeMailbox(encodeMailbox(box))).toEqual(box);
  });

  it("round-trips an empty mailbox", () => {
    const box = emptyMailbox();
    expect(decodeMailbox(encodeMailbox(box))).toEqual(box);
  });

  it("preserves the optional fields of a letter", () => {
    const [answered] = decodeMailbox(encodeMailbox(fullBox())).letters;
    expect(answered.reply).toBe("我今晚就改。");
    expect(answered.chosen).toBe("c1");
    expect(answered.depth).toBe(1);
    expect(answered.choices).toHaveLength(2);
  });

  it("writes gzip, not plain text", () => {
    const raw = encodeMailbox(fullBox());
    expect(raw[0]).toBe(0x1f);
    expect(raw[1]).toBe(0x8b);
  });

  it("comes out smaller than the JSON it holds", () => {
    const box = fullBox();
    const plain = Buffer.from(JSON.stringify({ box }), "utf8").length;
    expect(encodeMailbox(box).length).toBeLessThan(plain);
  });
});

describe("decodeMailbox failure modes", () => {
  it("throws on bytes that are not gzip at all", () => {
    expect(() => decodeMailbox(Buffer.from("this is not a mailbox"))).toThrow();
  });

  it("throws on gzip whose payload is not JSON", () => {
    const bad = gzipSync(Buffer.from("nope", "utf8"));
    expect(() => decodeMailbox(bad)).toThrow();
  });

  it("throws when the JSON is not a mailbox", () => {
    const wrong = gzipSync(Buffer.from(JSON.stringify({ box: 5 }), "utf8"));
    expect(() => decodeMailbox(wrong)).toThrow();
  });

  it("throws when a letter is missing the fields it needs", () => {
    const wrong = gzipSync(
      Buffer.from(JSON.stringify({ box: { letters: [{ id: "x" }] } }), "utf8"),
    );
    expect(() => decodeMailbox(wrong)).toThrow();
  });

  it("throws on a truncated file rather than half-reading it", () => {
    const full = encodeMailbox(fullBox());
    expect(() => decodeMailbox(full.subarray(0, full.length - 8))).toThrow();
  });
});

describe("decodeMailbox defaults", () => {
  it("fills in everything a minimal letter leaves out", () => {
    const minimal = gzipSync(
      Buffer.from(
        JSON.stringify({
          box: {
            letters: [
              { id: "m1", npcId: "npc_a", year: 12, subject: "s", body: "b" },
            ],
          },
        }),
        "utf8",
      ),
    );
    const box = decodeMailbox(minimal);
    expect(box.letters[0]).toEqual({
      id: "m1",
      npcId: "npc_a",
      year: 12,
      subject: "s",
      body: "b",
      choices: [],
      status: "unread",
      depth: 0,
    });
  });

  it("fills in the counters when the box carries none", () => {
    const minimal = gzipSync(Buffer.from(JSON.stringify({ box: {} }), "utf8"));
    expect(decodeMailbox(minimal)).toEqual(emptyMailbox());
  });
});
