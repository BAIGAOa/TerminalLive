import ReplRegistry from "./ReplRegistry.js";
import { parse } from "./ReplParser.js";

export interface Completion {
  /** Full candidate list for the token being completed. */
  candidates: string[];
  /** The longest common completion to offer as a ghost hint (may be ""). */
  ghost: string;
}

const EMPTY: Completion = { candidates: [], ghost: "" };

/** Complete the token at the end of `input`. */
export function complete(input: string, registry: ReplRegistry): Completion {
  const endsWithSpace = /\s$/.test(input);
  const tokens = input.trim().length ? parse(input).args : [];
  const parsed = parse(input);

  // Completing the command name itself (no trailing space yet).
  if (!endsWithSpace && tokens.length === 0) {
    const candidates = registry.completePrefix(parsed.name);
    return candidates.length ? { candidates, ghost: commonPrefix(candidates) } : EMPTY;
  }

  const cmd = registry.resolve(parsed.name);
  if (!cmd) return EMPTY;

  const consumed = endsWithSpace ? parsed.args.length : parsed.args.length - 1;
  const argIndex = Math.max(0, consumed);

  // Subcommands first (arg 0), then the command's own arg completion.
  if (cmd.subcommands?.length && argIndex === 0) {
    const partial = endsWithSpace ? "" : (parsed.args[parsed.args.length - 1] ?? "");
    const names = cmd.subcommands
      .map((s) => s.name)
      .filter((n) => n.startsWith(partial));
    return names.length ? { candidates: names, ghost: commonPrefix(names) } : EMPTY;
  }

  if (cmd.subcommands?.length && argIndex >= 1) {
    const sub = cmd.subcommands.find((s) => s.name === parsed.args[0]);
    if (sub?.complete) {
      const partial = endsWithSpace ? "" : (parsed.args[parsed.args.length - 1] ?? "");
      const candidates = sub
        .complete(parsed.args.slice(1, -1))
        .filter((n) => n.startsWith(partial));
      return candidates.length
        ? { candidates, ghost: commonPrefix(candidates) }
        : EMPTY;
    }
  }

  if (cmd.complete) {
    const partial = endsWithSpace ? "" : (parsed.args[parsed.args.length - 1] ?? "");
    const candidates = cmd
      .complete(parsed.args.slice(0, -1))
      .filter((n) => n.startsWith(partial));
    return candidates.length
      ? { candidates, ghost: commonPrefix(candidates) }
      : EMPTY;
  }

  return EMPTY;
}

/** Longest common prefix of a non-empty list. */
export function commonPrefix(items: string[]): string {
  if (items.length === 0) return "";
  let prefix = items[0];
  for (const item of items.slice(1)) {
    while (prefix && !item.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

/** Apply the first candidate (tab) — replaces the trailing token. */
export function applyCompletion(input: string, candidates: string[]): string {
  if (candidates.length === 0) return input;
  const endsWithSpace = /\s$/.test(input);
  if (endsWithSpace) return input + candidates[0];
  const cut = input.replace(/\S*$/, "");
  return cut + candidates[0];
}
