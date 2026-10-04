import { ReplCommand } from "./types.js";

/**
 * The main terminal's command table. Deliberately separate from the in-game
 * console's `CommandCenter`: this one supports aliases, subcommands and
 * completion, and only the terminal screen uses it.
 */
export default class ReplRegistry {
  private commands: ReplCommand[] = [];
  private byName = new Map<string, ReplCommand>();

  /** Register a command; throws on a duplicate name or alias. */
  public register(cmd: ReplCommand): void {
    const names = [cmd.name, ...(cmd.aliases ?? [])];
    for (const n of names) {
      if (this.byName.has(n)) {
        throw new Error(`repl command "${n}" 已注册`);
      }
    }
    this.commands.push(cmd);
    for (const n of names) this.byName.set(n, cmd);
  }

  /** Resolve a token to a command (by name or alias). */
  public resolve(token: string): ReplCommand | undefined {
    return this.byName.get(token.toLowerCase());
  }

  public all(): ReplCommand[] {
    return this.commands;
  }

  /** Visible commands (for help/completion). */
  public visible(): ReplCommand[] {
    return this.commands.filter((c) => !c.hidden);
  }

  /** Command names (+ aliases) starting with `prefix`. */
  public completePrefix(prefix: string): string[] {
    const p = prefix.toLowerCase();
    const out: string[] = [];
    for (const cmd of this.visible()) {
      for (const n of [cmd.name, ...(cmd.aliases ?? [])]) {
        if (n.startsWith(p)) out.push(n);
      }
    }
    return out.sort();
  }
}
