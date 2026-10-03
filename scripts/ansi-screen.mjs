/**
 * Minimal ANSI screen-buffer emulator. Reads a raw terminal capture on stdin
 * and prints the reconstructed final screen, plus (optionally) the 1-based
 * row/col of a search string, so tests can compute click coordinates.
 *
 * Usage: node scripts/ansi-screen.mjs [searchString]
 */
const COLS = Number(process.env.COLS || 100);
const ROWS = Number(process.env.ROWS || 40);

let cells = [];
let row = 0;
let col = 0;

function ensure(r) {
  while (cells.length <= r) cells.push(new Array(COLS).fill(" "));
}
function put(ch, w) {
  ensure(row);
  if (col < COLS) {
    cells[row][col] = ch;
    for (let i = 1; i < w; i++) {
      if (col + i < COLS) cells[row][col + i] = "";
    }
  }
  col += w;
}

const WIDE =
  /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

let data = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (data += d));
process.stdin.on("end", () => {
  let i = 0;
  while (i < data.length) {
    const c = data[i];
    if (c === "\u001b") {
      const next = data[i + 1];
      if (next === "[") {
        let j = i + 2;
        while (j < data.length && !/[A-Za-z]/.test(data[j])) j++;
        const body = data.slice(i + 2, j);
        const cmd = data[j];
        const params = body.replace(/^\?/, "").split(";").map((s) => Number(s) || 0);
        const n = (idx) => (params[idx] === 0 ? 1 : params[idx]);
        switch (cmd) {
          case "A": row = Math.max(0, row - n(0)); break;
          case "B": row = row + n(0); break;
          case "C": col += n(0); break;
          case "D": col = Math.max(0, col - n(0)); break;
          case "E": row += n(0); col = 0; break;
          case "F": row = Math.max(0, row - n(0)); col = 0; break;
          case "G": col = (params[0] || 1) - 1; break;
          case "H":
          case "f": {
            row = (params[0] || 1) - 1;
            col = (params[1] || 1) - 1;
            break;
          }
          case "J": if (body.includes("2") || params[0] === 2) cells = []; row = 0; col = 0; break;
          case "K": {
            if (params[0] === 2) {
              ensure(row);
              for (let x = 0; x < COLS; x++) cells[row][x] = " ";
            }
            break;
          }
          default: break;
        }
        i = j + 1;
        continue;
      }
      if (next === "]") {
        let j = i + 2;
        while (j < data.length && data[j] !== "\u0007" && !(data[j] === "\u001b" && data[j + 1] === "\\")) j++;
        i = data[j] === "\u0007" ? j + 1 : j + 2;
        continue;
      }
      i += 2;
      continue;
    }
    if (c === "\n") { row++; col = 0; i++; continue; }
    if (c === "\r") { col = 0; i++; continue; }
    if (c === "\t") { col = Math.ceil((col + 1) / 8) * 8; i++; continue; }
    const w = WIDE.test(c) ? 2 : 1;
    put(c, w);
    i++;
  }

  const lines = cells.map((r) => r.join("").replace(/\s+$/, ""));
  ensure(0);
  const search = process.argv[2];
  if (search) {
    for (let r = 0; r < lines.length; r++) {
      const idx = lines[r].indexOf(search);
      if (idx !== -1) {
        // idx is a character index; convert to a cell column
        const cellCol = cells[r].indexOf(search[0]);
        console.log(`FOUND row=${r + 1} col=${cellCol + 1}`);
        break;
      }
    }
  } else {
    console.log(lines.join("\n"));
  }
});
