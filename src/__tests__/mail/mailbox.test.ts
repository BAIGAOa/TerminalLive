import { describe, it, expect } from "vitest";
import {
  addLetter,
  emptyMailbox,
  fitMailbox,
  lettersBytes,
  utf8Length,
  MAILBOX_CAP,
  MAIL_LETTERS_MAX_BYTES,
} from "../../world/mail/mailbox.js";
import type { Letter } from "../../world/mail/letter.js";
import { MAX_BODY } from "../../world/mail/letter.js";

function letter(over: Partial<Letter> = {}): Letter {
  return {
    id: "mail-20-npc_a-1",
    npcId: "npc_a",
    year: 20,
    subject: "hello",
    body: "body",
    choices: [],
    status: "read",
    depth: 0,
    ...over,
  };
}

/** `count` letters, newest first, with predictable ids. */
function letters(count: number, over: (i: number) => Partial<Letter> = () => ({})) {
  return Array.from({ length: count }, (_, i) =>
    letter({ id: `l${i}`, year: 100 - i, ...over(i) }),
  );
}

describe("utf8Length", () => {
  it("counts an empty string as zero", () => {
    expect(utf8Length("")).toBe(0);
  });

  it("counts ASCII as one byte per character", () => {
    expect(utf8Length("abc")).toBe(3);
  });

  it("counts a two-byte character as two", () => {
    expect(utf8Length("é")).toBe(2);
  });

  it("counts CJK and other three-byte characters as three", () => {
    expect(utf8Length("你")).toBe(3);
    expect(utf8Length("€")).toBe(3);
  });

  it("counts an astral character as four, not as its two surrogates", () => {
    // A surrogate pair is one code point; counting each half would give six.
    expect(utf8Length("😀")).toBe(4);
  });

  it("adds the byte widths of a mixed string", () => {
    expect(utf8Length("a你😀")).toBe(1 + 3 + 4);
  });
});

describe("lettersBytes", () => {
  it("is the serialised size of the list, not of the letters alone", () => {
    expect(lettersBytes([])).toBe(2); // "[]"
    const one = [letter()];
    expect(lettersBytes(one)).toBe(utf8Length(JSON.stringify(one)));
  });

  it("grows with the bodies it holds", () => {
    const short = [letter({ body: "hi" })];
    const long = [letter({ body: "x".repeat(500) })];
    expect(lettersBytes(long)).toBeGreaterThan(lettersBytes(short));
  });
});

describe("fitMailbox", () => {
  it("leaves a list inside both budgets alone", () => {
    const list = letters(3);
    expect(fitMailbox(list, MAILBOX_CAP, MAIL_LETTERS_MAX_BYTES)).toEqual(list);
  });

  it("returns an empty list for an empty list", () => {
    expect(fitMailbox([], MAILBOX_CAP)).toEqual([]);
  });

  it("does not mutate the list it is given", () => {
    const list = letters(5);
    const before = list.map((l) => l.id);
    fitMailbox(list, 2);
    expect(list.map((l) => l.id)).toEqual(before);
  });

  it("drops from the oldest end, keeping the newest", () => {
    const kept = fitMailbox(letters(5), 3);
    expect(kept.map((l) => l.id)).toEqual(["l0", "l1", "l2"]);
  });

  it("drops the oldest *read* letters before it touches an unread one", () => {
    // Newest first: an unread letter at the head, read ones behind it.
    const list = [
      letter({ id: "new-unread", status: "unread" }),
      letter({ id: "mid-read", status: "read" }),
      letter({ id: "old-read", status: "read" }),
    ];
    const kept = fitMailbox(list, 2);
    expect(kept.map((l) => l.id)).toEqual(["new-unread", "mid-read"]);
  });

  it("keeps an unread letter at the expense of an older read one", () => {
    const list = [
      letter({ id: "answered", status: "answered" }),
      letter({ id: "waiting", status: "unread" }),
    ];
    expect(fitMailbox(list, 1).map((l) => l.id)).toEqual(["waiting"]);
  });

  it("drops the oldest letter anyway when every one is unread", () => {
    const list = letters(4, () => ({ status: "unread" as const }));
    expect(fitMailbox(list, 2).map((l) => l.id)).toEqual(["l0", "l1"]);
  });

  it("never keeps more than the count cap", () => {
    expect(fitMailbox(letters(MAILBOX_CAP + 7), MAILBOX_CAP)).toHaveLength(MAILBOX_CAP);
  });

  it("trims to the byte budget even when the count cap is not reached", () => {
    const list = letters(3, () => ({ body: "x".repeat(400) }));
    // Exactly the room one letter needs — the other two have to go.
    const budget = lettersBytes([list[0]]);
    const kept = fitMailbox(list, MAILBOX_CAP, budget);
    expect(kept).toHaveLength(1);
    expect(kept[0].id).toBe("l0");
    expect(lettersBytes(kept)).toBeLessThanOrEqual(budget);
  });

  it("empties the list rather than exceeding a budget too small for one letter", () => {
    const list = letters(2, () => ({ body: "x".repeat(200) }));
    expect(fitMailbox(list, MAILBOX_CAP, 1)).toEqual([]);
  });

  it("drops unread letters once no read ones are left to shed", () => {
    const list = [
      letter({ id: "unread-new", status: "unread", body: "x".repeat(400) }),
      letter({ id: "read-old", status: "read", body: "x".repeat(400) }),
    ];
    const budget = lettersBytes([list[0]]);
    const kept = fitMailbox(list, MAILBOX_CAP, budget);
    expect(kept.map((l) => l.id)).toEqual(["unread-new"]);
  });
});

describe("addLetter", () => {
  it("puts the new letter at the head", () => {
    const box = { ...emptyMailbox(), letters: letters(2) };
    const next = addLetter(box, letter({ id: "fresh" }));
    expect(next.letters.map((l) => l.id)).toEqual(["fresh", "l0", "l1"]);
  });

  it("leaves the rest of the box alone", () => {
    const box = {
      ...emptyMailbox(),
      cooldowns: { npc_a: 7 },
      sentThisYear: 3,
      letters: [],
    };
    const next = addLetter(box, letter());
    expect(next.cooldowns).toEqual({ npc_a: 7 });
    expect(next.sentThisYear).toBe(3);
  });

  it("does not mutate the box it is given", () => {
    const box = { ...emptyMailbox(), letters: letters(2) };
    addLetter(box, letter({ id: "fresh" }));
    expect(box.letters).toHaveLength(2);
  });

  it("trims back to the count cap on insert", () => {
    const box = { ...emptyMailbox(), letters: letters(MAILBOX_CAP) };
    const next = addLetter(box, letter({ id: "fresh" }));
    expect(next.letters).toHaveLength(MAILBOX_CAP);
    expect(next.letters[0].id).toBe("fresh");
  });

  it("honours an explicit cap", () => {
    const box = { ...emptyMailbox(), letters: letters(3) };
    const next = addLetter(box, letter({ id: "fresh" }), 2);
    expect(next.letters.map((l) => l.id)).toEqual(["fresh", "l0"]);
  });

  it("brings an oversized box back inside the default byte budget", () => {
    // Worst case on purpose: the longest letter the parser will ever accept,
    // in a language whose every character costs three bytes.
    const heavy = Array.from({ length: 60 }, (_, i) =>
      letter({ id: `h${i}`, status: "read", body: "你".repeat(MAX_BODY) }),
    );
    expect(lettersBytes(heavy)).toBeGreaterThan(MAIL_LETTERS_MAX_BYTES);

    const box = { ...emptyMailbox(), letters: heavy };
    const next = addLetter(box, letter({ id: "fresh", status: "unread" }));

    expect(lettersBytes(next.letters)).toBeLessThanOrEqual(MAIL_LETTERS_MAX_BYTES);
    expect(next.letters[0].id).toBe("fresh");
  });
});
