import { describe, it, expect } from "vitest";
import {
  layoutTextArea,
  moveVertical,
  rowEnd,
  rowStart,
} from "../../ui/textArea.js";

describe("layoutTextArea", () => {
  it("keeps one row per hard line when everything fits", () => {
    const { lines } = layoutTextArea("one\ntwo", 0, 20);
    expect(lines.map((l) => l.text)).toEqual(["one", "two"]);
    expect(lines[0]).toMatchObject({ start: 0, end: 3, wrapped: false });
    expect(lines[1]).toMatchObject({ start: 4, end: 7, wrapped: false });
  });

  it("soft-wraps a long line and marks the continuation as wrapped", () => {
    const { lines } = layoutTextArea("abcdefghij", 0, 4);
    expect(lines.map((l) => l.text)).toEqual(["abcd", "efgh", "ij"]);
    expect(lines.map((l) => l.wrapped)).toEqual([false, true, true]);
    // Offsets are contiguous, so a caret can be mapped back into the raw value.
    expect(lines.map((l) => [l.start, l.end])).toEqual([
      [0, 4],
      [4, 8],
      [8, 10],
    ]);
  });

  it("counts CJK glyphs as two cells when wrapping", () => {
    const { lines } = layoutTextArea("你好世界", 0, 4);
    expect(lines.map((l) => l.text)).toEqual(["你好", "世界"]);
  });

  it("keeps an empty line for a blank row", () => {
    const { lines } = layoutTextArea("a\n\nb", 0, 10);
    expect(lines.map((l) => l.text)).toEqual(["a", "", "b"]);
  });

  it("places the caret at the end of the row it was typed on at a soft break", () => {
    const { cursorRow, cursorCol } = layoutTextArea("abcdefghij", 4, 4);
    expect(cursorRow).toBe(0);
    expect(cursorCol).toBe(4);
    // One further along belongs to the continuation row.
    expect(layoutTextArea("abcdefghij", 5, 4)).toMatchObject({
      cursorRow: 1,
      cursorCol: 1,
    });
  });

  it("reports the caret column in cells, not characters", () => {
    expect(layoutTextArea("你好", 1, 20)).toMatchObject({ cursorRow: 0, cursorCol: 2 });
  });

  it("puts a caret after a newline on the next row", () => {
    const { cursorRow, cursorCol } = layoutTextArea("ab\ncd", 3, 20);
    expect(cursorRow).toBe(1);
    expect(cursorCol).toBe(0);
  });
});

describe("moveVertical", () => {
  it("walks straight down a wrapped answer", () => {
    // 4 columns: "abcd" / "efgh" / "ij"
    expect(moveVertical("abcdefghij", 1, 4, 1)).toBe(5);
    expect(moveVertical("abcdefghij", 5, 4, -1)).toBe(1);
  });

  it("holds the column across a shorter row by landing at its end", () => {
    // "abcdefgh" wraps to "abcd"/"efgh", then a short hard line "ij".
    const value = "abcdefghij";
    expect(moveVertical(value, 3, 4, 1)).toBe(7);
    expect(moveVertical(value, 9, 4, -1)).toBe(5);
  });

  it("stops at the first and last row instead of wrapping around", () => {
    const value = "one\ntwo";
    expect(moveVertical(value, 1, 20, -1)).toBe(1);
    expect(moveVertical(value, 5, 20, 1)).toBe(5);
  });

  it("holds the column in cells for CJK text", () => {
    // "你好" (4 cells) then "世界"
    expect(moveVertical("你好\n世界", 2, 20, 1)).toBe(5);
  });
});

describe("rowStart / rowEnd", () => {
  it("stay inside the caret's drawn row, not the whole value", () => {
    const value = "abcdefghij";
    expect(rowStart(value, 5, 4)).toBe(4);
    expect(rowEnd(value, 5, 4)).toBe(8);
  });

  it("stop at the newline rather than the next line's start", () => {
    const value = "ab\ncd";
    expect(rowEnd(value, 1, 20)).toBe(2);
    expect(rowStart(value, 2, 20)).toBe(0);
  });
});
