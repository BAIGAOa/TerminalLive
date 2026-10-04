import { describe, it, expect } from "vitest";
import { parse, splitTokens } from "../../core/repl/ReplParser.js";
import ReplRegistry from "../../core/repl/ReplRegistry.js";
import { applyCompletion, complete } from "../../core/repl/ReplCompleter.js";
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
