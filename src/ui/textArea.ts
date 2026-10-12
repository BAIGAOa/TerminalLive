/**
 * Multi-line editing model for {@link TextArea} — React-free so wrapping and
 * vertical caret movement are unit-testable without rendering.
 *
 * The caret is a UTF-16 index into the raw value (never mid-surrogate, like
 * `textEdit.ts`). The value keeps its own newlines; what the screen shows is a
 * *soft*-wrapped projection of it, and every wrapped row remembers which slice
 * of the raw value it came from — that mapping is what makes ↑/↓ land where the
 * user expects instead of jumping to a character count.
 *
 * Widths are terminal cells, not characters: a CJK glyph is two cells wide and
 * a caret column has to agree with that or it drifts on the second line.
 */

import stringWidth from "string-width";
import { clampCursor } from "./textEdit.js";

/** One row as drawn: a slice of the raw value, and where that slice came from. */
export interface AreaLine {
  /** The row's text, without its newline. */
  text: string;
  /** Offset of the row's first character in the raw value. */
  start: number;
  /** Offset just past the row's last character (the `\n`, if any, excluded). */
  end: number;
  /** True when this row only exists because the row above was too narrow. */
  wrapped: boolean;
}

export interface TextAreaLayout {
  lines: AreaLine[];
  /** Row the caret sits on. */
  cursorRow: number;
  /** The caret's column in terminal cells within that row. */
  cursorCol: number;
}

/** Read one code point at `i`, so surrogate pairs move as a unit. */
function codePointAt(s: string, i: number): { size: number } {
  const c = s.charCodeAt(i);
  if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
    const low = s.charCodeAt(i + 1);
    if (low >= 0xdc00 && low <= 0xdfff) return { size: 2 };
  }
  return { size: 1 };
}

function cellWidth(s: string, i: number, size: number): number {
  return stringWidth(s.slice(i, i + size));
}

/** The raw value's hard lines, as `[start, end)` offset pairs. */
function hardLines(value: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let from = 0;
  for (;;) {
    const nl = value.indexOf("\n", from);
    if (nl === -1) {
      spans.push([from, value.length]);
      return spans;
    }
    spans.push([from, nl]);
    from = nl + 1;
  }
}

/** Split `value` into rows no wider than `width` cells, keeping the offsets. */
function wrapWithOffsets(value: string, width: number): AreaLine[] {
  const lines: AreaLine[] = [];
  for (const [start, end] of hardLines(value)) {
    if (end === start) {
      // An empty line is still a line — that is the row a blank Enter makes.
      lines.push({ text: "", start, end, wrapped: false });
      continue;
    }
    let rowStart = start;
    let used = 0;
    let pos = start;
    let first = true;
    while (pos < end) {
      const { size } = codePointAt(value, pos);
      const w = cellWidth(value, pos, size);
      // Only break when the row already holds something: a glyph wider than the
      // whole row would otherwise loop forever on an empty row.
      if (used + w > width && pos > rowStart) {
        lines.push({
          text: value.slice(rowStart, pos),
          start: rowStart,
          end: pos,
          wrapped: !first,
        });
        rowStart = pos;
        used = 0;
        first = false;
        continue;
      }
      used += w;
      pos += size;
    }
    lines.push({
      text: value.slice(rowStart, end),
      start: rowStart,
      end,
      wrapped: !first,
    });
  }
  return lines;
}

/** Project the raw value into drawn rows and locate the caret in them. */
export function layoutTextArea(
  value: string,
  cursor: number,
  width: number,
): TextAreaLayout {
  const lines = wrapWithOffsets(value, Math.max(1, width));
  const at = clampCursor(value, cursor);

  let cursorRow = lines.length - 1;
  for (let i = 0; i < lines.length; i++) {
    // Containment, first match wins: at a soft break the offset is both the
    // upper row's end and the lower row's start, and the caret belongs at the
    // end of the row the user was typing on.
    if (at >= lines[i].start && at <= lines[i].end) {
      cursorRow = i;
      break;
    }
  }

  const line = lines[cursorRow];
  return {
    lines,
    cursorRow,
    cursorCol: stringWidth(value.slice(line.start, at)),
  };
}

/**
 * Move the caret `delta` rows, holding its column.
 *
 * The column is a cell count, so landing in a row that is too short for it
 * puts the caret at that row's end — the same thing every text editor does.
 */
export function moveVertical(
  value: string,
  cursor: number,
  width: number,
  delta: number,
): number {
  const at = clampCursor(value, cursor);
  const { lines, cursorRow, cursorCol } = layoutTextArea(value, at, width);
  const target = cursorRow + delta;
  if (target < 0 || target >= lines.length) return at;

  const line = lines[target];
  let col = 0;
  let pos = line.start;
  while (pos < line.end) {
    const { size } = codePointAt(value, pos);
    const w = cellWidth(value, pos, size);
    if (col + w > cursorCol) break;
    col += w;
    pos += size;
  }
  return pos;
}

/** The start of the caret's row (Home). */
export function rowStart(value: string, cursor: number, width: number): number {
  const { lines, cursorRow } = layoutTextArea(value, cursor, width);
  return lines[cursorRow].start;
}

/** The end of the caret's row (End). */
export function rowEnd(value: string, cursor: number, width: number): number {
  const { lines, cursorRow } = layoutTextArea(value, cursor, width);
  return lines[cursorRow].end;
}
