import { describe, it, expect } from "vitest";
import { parse, splitTokens } from "../../core/repl/ReplParser.js";
import ReplRegistry from "../../core/repl/ReplRegistry.js";
import { applyCompletion, complete } from "../../core/repl/ReplCompleter.js";
import { describeCommand } from "../../core/repl/ReplDescribe.js";
import ReplHistory from "../../core/repl/ReplHistory.js";
import { ReplCommand } from "../../core/repl/types.js";

const noop = () => {};

function mk(name: string, extra: Partial<ReplCommand> = {}): ReplCommand {
  return { name, summary: `${name}.summary`, run: noop, ...extra };
}

describe("ReplParser", () => {
  it("splits on whitespace", () => {
    expect(splitTokens("play   childhood")).toEqual(["play", "childhood"]);
  });

  it("keeps quoted segments together", () => {
    expect(splitTokens('echo "a b" c')).toEqual(["echo", "a b", "c"]);
    expect(splitTokens("say 'hello world'")).toEqual(["say", "hello world"]);
  });

  it("lower-cases the command name but not the args", () => {
    const p = parse("PLAY Childhood");
    expect(p.name).toBe("play");
    expect(p.args).toEqual(["Childhood"]);
  });

  it("returns an empty name for a blank line", () => {
    expect(parse("   ").name).toBe("");
  });
});

describe("ReplRegistry", () => {
  it("resolves names and aliases", () => {
    const reg = new ReplRegistry();
    reg.register(mk("achievements", { aliases: ["ach"] }));
    expect(reg.resolve("achievements")?.name).toBe("achievements");
    expect(reg.resolve("ACH")?.name).toBe("achievements");
    expect(reg.resolve("nope")).toBeUndefined();
  });

  it("rejects a duplicate name or alias", () => {
    const reg = new ReplRegistry();
    reg.register(mk("play", { aliases: ["go"] }));
    expect(() => reg.register(mk("play"))).toThrow();
    expect(() => reg.register(mk("start", { aliases: ["go"] }))).toThrow();
  });

  it("hides hidden commands from completion", () => {
    const reg = new ReplRegistry();
    reg.register(mk("play"));
    reg.register(mk("debug", { hidden: true }));
    expect(reg.completePrefix("")).toEqual(expect.arrayContaining(["play"]));
    expect(reg.completePrefix("")).not.toContain("debug");
  });
});

describe("ReplCompleter", () => {
  const reg = new ReplRegistry();
  reg.register(
    mk("play", { complete: () => ["childhood", "youth"] }),
  );
  reg.register(
    mk("settings", {
      subcommands: [
        { name: "theme", summary: "s", run: noop },
        { name: "language", summary: "s", run: noop },
      ],
    }),
  );
  reg.register(mk("help"));

  it("completes the command name", () => {
    expect(complete("pl", reg).candidates).toEqual(["play"]);
  });

  it("completes subcommands", () => {
    const c = complete("settings ", reg);
    expect(c.candidates.sort()).toEqual(["language", "theme"]);
  });

  it("completes command arguments", () => {
    const c = complete("play y", reg);
    expect(c.candidates).toEqual(["youth"]);
  });

  it("offers the longest common prefix as a ghost", () => {
    const c = complete("settings ", reg);
    expect(c.ghost).toBe("");
  });

  it("applyCompletion replaces the trailing token", () => {
    expect(applyCompletion("pl", ["play"])).toBe("play");
    expect(applyCompletion("settings th", ["theme"])).toBe("settings theme");
    expect(applyCompletion("settings ", ["theme"])).toBe("settings theme");
  });

  it("keeps the description keys of argument candidates", () => {
    const r = new ReplRegistry();
    r.register(
      mk("open", {
        complete: () => [{ value: "alpha", detailKey: "d.alpha" }, { value: "beta" }],
      }),
    );

    const picked = complete("open a", r);
    expect(picked.candidates).toEqual(["alpha"]);
    expect(picked.details).toEqual({ alpha: "d.alpha" });

    // Bare strings stay valid candidates — they just carry no description.
    const all = complete("open ", r);
    expect(all.candidates).toEqual(["alpha", "beta"]);
    expect(all.details).toEqual({ alpha: "d.alpha" });
  });

  it("reports no details for command and subcommand names", () => {
    expect(complete("pl", reg).details).toEqual({});
    expect(complete("settings ", reg).details).toEqual({});
  });
});

describe("ReplDescribe", () => {
  const reg = new ReplRegistry();
  reg.register(
    mk("play", { summary: "play.summary", usage: "play <stage>", complete: () => ["childhood", "youth"] }),
  );
  reg.register(
    mk("settings", {
      summary: "settings.summary",
      subcommands: [
        { name: "theme", summary: "theme.summary", usage: "theme <id>", run: noop },
        { name: "language", summary: "language.summary", run: noop },
      ],
    }),
  );
  // Shares its name with `settings`' subcommand, so the two must not be confused.
  reg.register(mk("theme", { summary: "top.theme.summary" }));
  const t = (key: string) => key;

  it("describes the highlighted top-level candidate", () => {
    const d = describeCommand("p", ["play"], 0, reg, t);
    expect(d).toEqual({ name: "play", summary: "play.summary", usage: "play <stage>" });
  });

  it("follows the highlight, not the first candidate", () => {
    const d = describeCommand("s", ["settings", "theme"], 1, reg, t);
    expect(d?.name).toBe("theme");
    expect(d?.summary).toBe("top.theme.summary");
  });

  it("describes a subcommand when completing the first argument", () => {
    // `theme` is also a top-level command — the subcommand must win here.
    expect(describeCommand("settings th", ["theme"], 0, reg, t)).toEqual({
      name: "theme",
      summary: "theme.summary",
      usage: "theme <id>",
    });
    expect(describeCommand("settings ", ["theme", "language"], 1, reg, t)?.summary).toBe(
      "language.summary",
    );
  });

  it("falls back to the typed command for argument values", () => {
    // "childhood" is an argument value, so it has no entry of its own.
    const d = describeCommand("play ch", ["childhood"], 0, reg, t);
    expect(d?.name).toBe("play");
  });

  it("describes an argument value that carries its own detail", () => {
    const d = describeCommand("play ch", ["childhood", "youth"], 0, reg, t, {
      childhood: "level.childhood",
    });
    // The id on the usage line, its name below — not the command's help.
    expect(d).toEqual({
      name: "childhood",
      usage: "childhood",
      summary: "level.childhood",
    });
  });

  it("only uses a detail for the highlighted candidate", () => {
    const details = { childhood: "level.childhood" };
    expect(describeCommand("play y", ["youth"], 0, reg, t, details)?.name).toBe("play");
  });

  it("describes the typed command when nothing is highlighted", () => {
    expect(describeCommand("settings gl", [], 0, reg, t)?.name).toBe("settings");
  });

  it("drops a usage line that only repeats the command name", () => {
    const bare = new ReplRegistry();
    bare.register(mk("clear", { summary: "clear.summary", usage: "clear" }));
    expect(describeCommand("clear", [], 0, bare, t)?.usage).toBeUndefined();
  });

  it("has nothing to say about an unknown or blank line", () => {
    expect(describeCommand("nope", [], 0, reg, t)).toBeNull();
    expect(describeCommand("", [], 0, reg, t)).toBeNull();
  });
});

describe("ReplHistory", () => {
  it("walks older and newer entries", () => {
    const h = new ReplHistory();
    h.push("one");
    h.push("two");
    expect(h.prev()).toBe("two");
    expect(h.prev()).toBe("one");
    expect(h.prev()).toBe("one"); // stays at the oldest
    expect(h.next()).toBe("two");
    expect(h.next()).toBeNull(); // back to a fresh line
  });

  it("skips consecutive duplicates", () => {
    const h = new ReplHistory();
    h.push("x");
    h.push("x");
    expect(h.all()).toEqual(["x"]);
  });
});
