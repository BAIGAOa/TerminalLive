/** A line in the terminal scrollback. */
export type MsgKind = "info" | "success" | "error" | "dim" | "input";

export interface ScrollLine {
  id: number;
  kind: MsgKind;
  text: string;
}

export type TranslateFn = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/** Everything a command needs to print output and chain further commands. */
export interface ReplContext {
  args: string[];
  raw: string;
  print: (text: string, kind?: MsgKind) => void;
  /** Clear the current output surface (the scrollback / the console results). */
  clear: () => void;
  /** Close the host surface (the console) before navigating away, if any. */
  close?: () => void;
  t: TranslateFn;
  /** Run another command line (used by e.g. an interactive `help`). */
  run: (line: string) => void;
}

/** Where a command's output goes (the terminal scrollback, or the console). */
export interface ReplSink {
  print: (text: string, kind?: MsgKind) => void;
  clear: () => void;
  close?: () => void;
}

export interface ReplSubcommand {
  name: string;
  /** i18n key for the one-line description. */
  summary: string;
  usage?: string;
  /** Answers for the Nth argument (0 = first arg after the subcommand). */
  complete?: (args: string[]) => string[];
  run: (ctx: ReplContext) => void | Promise<void>;
}

export interface ReplCommand {
  name: string;
  aliases?: string[];
  /** i18n key for the one-line description. */
  summary: string;
  usage?: string;
  /** Hide from `help` / completion (still runnable). */
  hidden?: boolean;
  subcommands?: ReplSubcommand[];
  /** Answers for the Nth argument (0 = first arg after the command name). */
  complete?: (args: string[]) => string[];
  run: (ctx: ReplContext) => void | Promise<void>;
}
