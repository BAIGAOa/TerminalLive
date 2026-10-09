import { describe, it, expect } from "vitest";
import {
  firstEnabled,
  lastEnabled,
  seek,
  windowStart,
} from "../../ui/kit/listNav.js";
import type { MenuEntry } from "../../ui/kit/MenuList.js";

const item = (value: string, disabled = false): MenuEntry => ({
  value,
  label: value,
  disabled,
});

describe("firstEnabled", () => {
  it("returns the first enabled index at or after `from`", () => {
    const items = [item("a", true), item("b"), item("c")];
    expect(firstEnabled(items)).toBe(1);
    expect(firstEnabled(items, 2)).toBe(2);
  });

  it("wraps around to the start", () => {
    const items = [item("a"), item("b", true)];
    expect(firstEnabled(items, 1)).toBe(0);
  });

  it("falls back to 0 when everything is disabled", () => {
    expect(firstEnabled([item("a", true), item("b", true)])).toBe(0);
    expect(firstEnabled([])).toBe(0);
  });
});

describe("lastEnabled", () => {
  it("returns the last enabled index", () => {
    expect(lastEnabled([item("a"), item("b"), item("c", true)])).toBe(1);
  });

  it("returns 0 when empty or all disabled", () => {
    expect(lastEnabled([])).toBe(0);
    expect(lastEnabled([item("a", true)])).toBe(0);
  });
});

describe("seek", () => {
  const items = [item("a"), item("b", true), item("c")];

  it("skips disabled rows", () => {
    expect(seek(items, 0, 1, true)).toBe(2);
    expect(seek(items, 2, -1, true)).toBe(0);
  });

  it("wraps with `wrap` and rejects boundary moves without it", () => {
    expect(seek(items, 2, 1, true)).toBe(0);
    expect(seek(items, 2, 1, false)).toBe(2);
    expect(seek(items, 0, -1, true)).toBe(2);
    expect(seek(items, 0, -1, false)).toBe(0);
  });

  it("supports multi-step moves", () => {
    expect(seek(items, 0, 2, true)).toBe(2);
    expect(seek(items, 0, 3, false)).toBe(0);
  });

  it("returns the origin for a zero step or an empty list", () => {
    expect(seek(items, 1, 0, true)).toBe(1);
    expect(seek([], 0, 1, true)).toBe(0);
  });

  it("never lands on a disabled row when one is reachable", () => {
    const onlyB = [item("a", true), item("b"), item("c", true)];
    expect(seek(onlyB, 0, 1, true)).toBe(1);
    expect(seek(onlyB, 1, 1, true)).toBe(1);
    expect(seek(onlyB, 1, -1, true)).toBe(1);
  });
});

describe("windowStart", () => {
  it("does not scroll while everything fits", () => {
    expect(windowStart(0, 5, 5)).toBe(0);
    expect(windowStart(4, 5, 8)).toBe(0);
    expect(windowStart(9, 5, 0)).toBe(0);
  });

  it("holds still until the highlight reaches an edge", () => {
    // A 6-row window over 20 items, already at the top.
    expect(windowStart(3, 20, 6, 0)).toBe(0);
    expect(windowStart(5, 20, 6, 0)).toBe(0);
  });

  it("follows the highlight one row past the bottom edge", () => {
    expect(windowStart(6, 20, 6, 0)).toBe(1);
    expect(windowStart(9, 20, 6, 3)).toBe(4);
  });

  it("scrolls back when the highlight goes above the window", () => {
    expect(windowStart(2, 20, 6, 5)).toBe(2);
  });

  it("clamps at both ends", () => {
    expect(windowStart(0, 20, 6, 0)).toBe(0);
    // Last item: the window stops with it on the bottom row.
    expect(windowStart(19, 20, 6, 0)).toBe(14);
    expect(windowStart(19, 20, 6, 99)).toBe(14);
  });
});
