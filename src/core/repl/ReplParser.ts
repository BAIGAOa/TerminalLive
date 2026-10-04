/** Split a command line into tokens, honouring single/double quotes. */
export function splitTokens(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let has = false;

  for (const ch of input) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
      continue;
    }
    if (ch === " " || ch === "\t") {
      if (has || current.length > 0) tokens.push(current);
      current = "";
      has = false;
      continue;
    }
    current += ch;
    has = true;
  }
  if (has || current.length > 0) tokens.push(current);
  return tokens;
}

export interface ParsedLine {
  /** Command name, lower-cased (empty when the line is blank). */
  name: string;
  args: string[];
}

/** Parse a raw line into a lower-cased command name plus its arguments. */
export function parse(input: string): ParsedLine {
  const tokens = splitTokens(input.trim());
  if (tokens.length === 0) return { name: "", args: [] };
  const [name, ...args] = tokens;
  return { name: name.toLowerCase(), args };
}
