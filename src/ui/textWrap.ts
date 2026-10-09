import stringWidth from "string-width";

/**
 * Soft-wrap plain text into terminal rows (React-free, so it can be tested).
 *
 * The console prints into a fixed-height viewport whose every row is exactly
 * one terminal line, so long output has to be split here rather than left to
 * `<Text>` — a component that wraps on its own would push the panel's rows out
 * of step with its scroll offset.
 */

/** Soft-wrap `text` into rows no wider than `width` cells. */
export function wrapLine(text: string, width: number): string[] {
  if (width < 1) return [text];

  const rows: string[] = [];
  for (const paragraph of text.split("\n")) {
    let row = "";
    let used = 0;
    const push = () => {
      // A break leaves the space that caused it at the end of the row; it is
      // invisible there and only eats a cell.
      rows.push(row.trimEnd());
      row = "";
      used = 0;
    };

    // Whitespace runs are tokens too: console output is indented (the `help`
    // listing pads command usage by two cells) and splitting on " " would drop
    // that leading indent.
    for (const token of paragraph.match(/\s+|\S+/g) ?? []) {
      const tokenWidth = stringWidth(token);
      if (used + tokenWidth <= width) {
        row += token;
        used += tokenWidth;
        continue;
      }
      if (/^\s+$/.test(token)) {
        // Whitespace that no longer fits is dropped — it would only be
        // trailing padding, and the next word starts the following row.
        if (row) push();
        continue;
      }
      if (row) push();
      if (tokenWidth <= width) {
        row = token;
        used = tokenWidth;
        continue;
      }
      // A single word wider than a row (a long id, a path): hard-break it on
      // cell boundaries, keeping wide characters whole.
      let chunk = "";
      let chunkWidth = 0;
      for (const char of token) {
        const charWidth = stringWidth(char);
        if (chunkWidth + charWidth > width) {
          rows.push(chunk);
          chunk = "";
          chunkWidth = 0;
        }
        chunk += char;
        chunkWidth += charWidth;
      }
      row = chunk;
      used = chunkWidth;
    }
    push();
  }
  return rows;
}
