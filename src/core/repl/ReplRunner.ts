import { inject } from "../../Container.js";
import ReplRegistry from "./ReplRegistry.js";
import ReplStore from "./ReplStore.js";
import { parse } from "./ReplParser.js";
import { ReplCommand, ReplContext, ReplSink, TranslateFn } from "./types.js";

/**
 * Executes command lines: parse → resolve → dispatch (subcommands, arguments).
 * Output goes to a {@link ReplSink}: by default the terminal scrollback, but the
 * in-game console passes its own sink so results land in the console's list.
 */
export default class ReplRunner {
  private registry: ReplRegistry;
  private store: ReplStore;
  private t: TranslateFn = (key) => key;

  constructor() {
    this.registry = inject(ReplRegistry);
    this.store = inject(ReplStore);
  }

  /** Supply the i18n translator (called by the consuming screen on render). */
  public setTranslator(t: TranslateFn): void {
    this.t = t;
  }

  /**
   * Execute a raw line. `sink` decides where output goes; `echo` prints a
   * `> line` header first (off when the caller already echoes the input).
   */
  public execute(
    line: string,
    options: { sink?: ReplSink; echo?: boolean } = {},
  ): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    const sink: ReplSink =
      options.sink ??
      ({
        print: (text, kind = "info") => this.store.append(text, kind),
        clear: () => this.store.clear(),
      } satisfies ReplSink);

    if (options.echo !== false) sink.print(`> ${trimmed}`, "input");

    const { name, args } = parse(trimmed);
    const cmd = this.registry.resolve(name);
    if (!cmd) {
      sink.print(this.t("repl.err.unknown", { name }), "error");
      return;
    }
    this.dispatch(cmd, args, trimmed, sink);
  }

  private dispatch(
    cmd: ReplCommand,
    args: string[],
    raw: string,
    sink: ReplSink,
  ): void {
    const ctx: ReplContext = {
      args,
      raw,
      print: (text, kind = "info") => sink.print(text, kind),
      clear: () => sink.clear(),
      close: sink.close,
      t: this.t,
      run: (next) => this.execute(next, { sink, echo: false }),
    };

    try {
      const sub =
        cmd.subcommands?.length && args.length > 0
          ? cmd.subcommands.find((s) => s.name === args[0].toLowerCase())
          : undefined;
      if (sub) {
        sub.run({ ...ctx, args: args.slice(1) });
        return;
      }
      cmd.run(ctx);
    } catch (err) {
      sink.print(
        this.t("repl.err.failed", { error: (err as Error).message }),
        "error",
      );
    }
  }
}
