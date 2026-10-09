import { ReplCommand } from "./types.js";

/**
 * The terminal's command table — aliases, subcommands and completion. Backs
 * both the REPL screen and the in-game developer console (`P`).
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

  /**
   * Insert or replace a command by name — what plugins use.
   *
   * Replacing drops the old command outright, aliases included, so a plugin
   * that overrides `mods` cannot leave a stale `mod` alias pointing at the
   * built-in. Any other command whose name or alias collides is displaced too,
   * for the same reason: the newest registration owns its tokens.
   */
  public set(cmd: ReplCommand): void {
    const names = [cmd.name, ...(cmd.aliases ?? [])];
    for (const n of [...new Set(names)]) {
      const clash = this.byName.get(n.toLowerCase());
      if (clash) this.remove(clash);
    }
    this.register(cmd);
  }

  /** Drop a command and every name that resolves to it. */
  public remove(cmd: ReplCommand): void {
    const index = this.commands.indexOf(cmd);
    if (index !== -1) this.commands.splice(index, 1);
    for (const [name, target] of [...this.byName]) {
      if (target === cmd) this.byName.delete(name);
    }
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
