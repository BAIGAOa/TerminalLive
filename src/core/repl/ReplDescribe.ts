import ReplRegistry from "./ReplRegistry.js";
import { parse } from "./ReplParser.js";
import { TranslateFn } from "./types.js";

/** One-line help for the command (or subcommand) the console cursor is on. */
export interface CommandDescription {
  /** Canonical name of the command being described. */
  name: string;
  /** Translated one-line summary. */
  summary: string;
  /** Usage string, when the command declares one. */
  usage?: string;
}

function describe(
  name: string,
  summaryKey: string,
  usage: string | undefined,
  t: TranslateFn,
): CommandDescription {
  // Plenty of commands declare their bare name as the usage. Repeating the name
  // the user is already looking at tells them nothing, so drop it and keep the
  // block one row tall.
  const meaningful = usage && usage.trim() !== name ? usage : undefined;
  return { name, summary: t(summaryKey), usage: meaningful };
}

/**
 * The description to show under the console for the current input: the
 * highlighted completion candidate when there is one, otherwise the command
 * already typed.
 *
 * Which token a candidate stands for mirrors {@link complete} exactly — the
 * same cases (command name, subcommand name, argument value) — so the two never
 * disagree about what is being offered. An argument value with a `details` entry
 * describes itself; one without falls back to its command.
 */
export function describeCommand(
  input: string,
  candidates: readonly string[],
  index: number,
  registry: ReplRegistry,
  t: TranslateFn,
  details: Record<string, string> = {},
): CommandDescription | null {
  const parsed = parse(input);
  const typed = registry.resolve(parsed.name);
  const endsWithSpace = /\s$/.test(input);
  const consumed = endsWithSpace ? parsed.args.length : parsed.args.length - 1;
  const argIndex = Math.max(0, consumed);
  const highlighted = candidates[index];

  if (highlighted) {
    // An argument value that describes itself: the id on the usage line, its
    // name below. The command's own help says nothing about which value to
    // pick, so this wins over the fallbacks further down.
    const detailKey = details[highlighted];
    if (detailKey) {
      return { name: highlighted, usage: highlighted, summary: t(detailKey) };
    }

    // Completing the command name itself (no arguments typed yet).
    if (parsed.args.length === 0 && !endsWithSpace) {
      const cmd = registry.resolve(highlighted);
      if (cmd) return describe(cmd.name, cmd.summary, cmd.usage, t);
    } else if (argIndex === 0 && typed?.subcommands?.length) {
      // Arg 0 of a command that has subcommands completes subcommand names.
      const sub = typed.subcommands.find((s) => s.name === highlighted);
      if (sub) return describe(highlighted, sub.summary, sub.usage, t);
    }
  }

  return typed ? describe(typed.name, typed.summary, typed.usage, t) : null;
}
