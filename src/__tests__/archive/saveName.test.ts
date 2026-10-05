import { describe, it, expect } from "vitest";
import { resolve, join } from "node:path";
import {
  isValidSaveName,
  resolveWithin,
  MAX_SAVE_NAME_LENGTH,
} from "../../core/archive/saveName.js";

describe("isValidSaveName", () => {
  it("accepts ordinary names, including CJK and separators-in-spirit", () => {
    for (const name of ["save1", "My Run 2", "存档-01", "a_b.c", "x"]) {
      expect(isValidSaveName(name), name).toBe(true);
    }
  });

  it("rejects path traversal and separator characters", () => {
    for (const name of [
      "..",
      ".",
      "../evil",
      "..\\evil",
      "a/b",
      "a\\b",
      "/etc/passwd",
      "~/x",
    ]) {
      expect(isValidSaveName(name), name).toBe(false);
    }
  });

  it("rejects empty, over-long, leading-dot and whitespace-padded names", () => {
    expect(isValidSaveName("")).toBe(false);
    expect(isValidSaveName(" pad ")).toBe(false);
    expect(isValidSaveName(".hidden")).toBe(false);
    expect(isValidSaveName("x".repeat(MAX_SAVE_NAME_LENGTH + 1))).toBe(false);
    expect(isValidSaveName("x".repeat(MAX_SAVE_NAME_LENGTH))).toBe(true);
  });

  it("rejects Windows reserved device names", () => {
    for (const name of ["con", "NUL", "Lpt1", "com9"]) {
      expect(isValidSaveName(name), name).toBe(false);
    }
  });

  it("rejects control characters", () => {
    expect(isValidSaveName("a\u0000b")).toBe(false);
    expect(isValidSaveName("a\nb")).toBe(false);
  });
});

describe("resolveWithin", () => {
  const root = resolve("/home/player/.archive_live");

  it("returns the joined path for a plain name", () => {
    expect(resolveWithin(root, "slot1")).toBe(join(root, "slot1"));
  });

  it("refuses to escape the root", () => {
    for (const name of ["../outside", "../../etc", "a/../../b", "/tmp/evil"]) {
      expect(() => resolveWithin(root, name), name).toThrow();
    }
  });

  it("refuses the root itself", () => {
    expect(() => resolveWithin(root, "..")).toThrow();
    expect(() => resolveWithin(root, ".")).toThrow();
  });
});
