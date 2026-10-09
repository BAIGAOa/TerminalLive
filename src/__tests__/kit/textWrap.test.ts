import { describe, it, expect } from "vitest";
import { wrapLine } from "../../ui/textWrap.js";

/** Every row fits the width it was wrapped to. */
function allFit(rows: string[], width: number): boolean {
  return rows.every((row) => [...row].length <= width);
}

describe("wrapLine", () => {
  it("leaves text that already fits alone", () => {
    expect(wrapLine("hello", 10)).toEqual(["hello"]);
    expect(wrapLine("", 10)).toEqual([""]);
  });

  it("breaks on spaces, dropping the space at the break", () => {
    expect(wrapLine("one two three", 8)).toEqual(["one two", "three"]);
  });

  it("hard-breaks a word longer than a whole row", () => {
    expect(wrapLine("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("keeps a wide (CJK) character whole and counts it as two cells", () => {
    expect(wrapLine("中文字符", 4)).toEqual(["中文", "字符"]);
    // Five cells would split 字 down the middle — it moves to the next row.
    expect(wrapLine("中文a", 4)).toEqual(["中文", "a"]);
    expect(allFit(wrapLine("中文aa", 5), 5)).toBe(true);
  });

  it("preserves the leading indent of a wrapped line", () => {
    expect(wrapLine("  play [levelId]", 20)).toEqual(["  play [levelId]"]);
    expect(wrapLine("  aaa bbb ccc", 8)).toEqual(["  aaa", "bbb ccc"]);
  });

  it("keeps explicit newlines as row breaks", () => {
    expect(wrapLine("a\nb", 10)).toEqual(["a", "b"]);
    expect(wrapLine("a\n", 10)).toEqual(["a", ""]);
  });

  it("never returns a row wider than the width", () => {
    const rows = wrapLine("mods [list|reload|watch|example] 已安装模组", 10);
    expect(allFit(rows, 10)).toBe(true);
    expect(rows.join("").replace(/\s/g, "")).toBe(
      "mods[list|reload|watch|example]已安装模组".replace(/\s/g, ""),
    );
  });

  it("returns the text as-is when there is no room to wrap", () => {
    expect(wrapLine("abc", 0)).toEqual(["abc"]);
  });
});
