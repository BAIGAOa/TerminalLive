import { describe, it, expect } from "vitest";
import {
  TextEditState,
  backspace,
  caretEnd,
  caretLeft,
  caretRight,
  caretStart,
  clampCursor,
  clear,
  deleteForward,
  insertText,
  maskedCursor,
  splitAtCaret,
  stepLeft,
  stepRight,
} from "../../ui/textEdit.js";

/** A caret at the end of `value`, like a freshly typed line. */
const atEnd = (value: string): TextEditState => ({
  value,
  cursor: value.length,
});

const at = (value: string, cursor: number): TextEditState => ({ value, cursor });

describe("clampCursor", () => {
  it("keeps the caret inside the value", () => {
    expect(clampCursor("abc", -5)).toBe(0);
    expect(clampCursor("abc", 99)).toBe(3);
    expect(clampCursor("abc", 1)).toBe(1);
    expect(clampCursor("", 4)).toBe(0);
  });

  it("never lands inside a surrogate pair", () => {
    const emoji = "a😀b"; // 😀 is two code units: indices 1-2
    expect(clampCursor(emoji, 2)).toBe(1);
  });
});

describe("stepping", () => {
  it("moves one character at a time", () => {
    expect(stepRight("abc", 0)).toBe(1);
    expect(stepLeft("abc", 3)).toBe(2);
  });

  it("stops at the ends", () => {
    expect(stepLeft("abc", 0)).toBe(0);
    expect(stepRight("abc", 3)).toBe(3);
  });

  it("counts a surrogate pair as one character", () => {
    const emoji = "😀b";
    expect(stepRight(emoji, 0)).toBe(2);
    expect(stepLeft(emoji, 2)).toBe(0);
  });
});

describe("caret movement", () => {
  it("walks left and right over the line", () => {
    let s = atEnd("hello");
    s = caretLeft(s);
    s = caretLeft(s);
    expect(s.cursor).toBe(3);
    s = caretRight(s);
    expect(s.cursor).toBe(4);
  });

  it("jumps to either end, and neither moves the text", () => {
    expect(caretStart(at("hello", 3))).toEqual({ value: "hello", cursor: 0 });
    expect(caretEnd(at("hello", 1))).toEqual({ value: "hello", cursor: 5 });
  });
});

describe("insertText", () => {
  it("inserts at the caret, not at the end", () => {
    expect(insertText(at("helo", 3), "l")).toEqual({ value: "hello", cursor: 4 });
    expect(insertText(at("ac", 1), "b")).toEqual({ value: "abc", cursor: 2 });
  });

  it("appends when the caret is at the end", () => {
    expect(insertText(atEnd("ab"), "c")).toEqual({ value: "abc", cursor: 3 });
  });
});

describe("deleting", () => {
  it("backspace eats the character before the caret", () => {
    expect(backspace(at("hello", 3))).toEqual({ value: "helo", cursor: 2 });
  });

  it("backspace does nothing at the start", () => {
    expect(backspace(at("hello", 0))).toEqual({ value: "hello", cursor: 0 });
  });

  it("delete eats the character at the caret, leaving it put", () => {
    expect(deleteForward(at("hello", 1))).toEqual({ value: "hllo", cursor: 1 });
  });

  it("delete does nothing at the end", () => {
    expect(deleteForward(at("hello", 5))).toEqual({ value: "hello", cursor: 5 });
  });

  it("neither ever splits a surrogate pair", () => {
    // Backspace after the emoji removes both of its code units, not one.
    expect(backspace(at("😀b", 2))).toEqual({ value: "b", cursor: 0 });
    // Forward delete at the emoji does the same.
    expect(deleteForward(at("😀b", 0))).toEqual({ value: "b", cursor: 0 });
  });
});

describe("clear", () => {
  it("empties the line and parks the caret at the start", () => {
    expect(clear(at("hello", 3))).toEqual({ value: "", cursor: 0 });
  });
});

describe("splitAtCaret", () => {
  it("splits the text around the caret", () => {
    expect(splitAtCaret(at("hello", 2))).toEqual({ before: "he", after: "llo" });
    expect(splitAtCaret(at("hello", 0))).toEqual({ before: "", after: "hello" });
    expect(splitAtCaret(at("hello", 5))).toEqual({ before: "hello", after: "" });
  });

  it("rejoins to the original text", () => {
    const s = at("hello", 3);
    const { before, after } = splitAtCaret(s);
    expect(before + after).toBe(s.value);
  });
});

describe("maskedCursor", () => {
  it("maps a single-character mask straight across", () => {
    expect(maskedCursor("secret", 4, "•")).toBe(4);
  });

  it("counts a multi-unit mask per input character", () => {
    // An emoji mask is two code units wide: the caret after 3 characters must
    // land after 3 mask characters, not after 3 code units.
    expect(maskedCursor("abc", 3, "🔒")).toBe(6);
    expect(maskedCursor("abc", 1, "🔒")).toBe(2);
  });

  it("counts characters, not code units, of the value", () => {
    // The value itself can hold a surrogate pair; one character, one mask.
    expect(maskedCursor("😀a", 3, "*")).toBe(2);
  });

  it("is a no-op without a mask", () => {
    expect(maskedCursor("abc", 2, "")).toBe(2);
  });
});
