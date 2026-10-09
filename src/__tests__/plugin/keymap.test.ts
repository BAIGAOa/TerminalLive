import { describe, it, expect } from "vitest";
import { findConflicts, resolveKeymap } from "../../ui/keymap.js";
import KeyActionRegistry, {
  type KeyAction,
} from "../../core/registry/KeyActionRegistry.js";

const ACTIONS: KeyAction[] = [
  { id: "console", labelKey: "k.console", defaultKey: "p" },
  { id: "help", labelKey: "k.help", defaultKey: "?" },
  { id: "menu", labelKey: "k.menu", defaultKey: "q" },
];

describe("resolveKeymap", () => {
  it("falls back to the default for an action nobody rebound", () => {
    expect(resolveKeymap(undefined, ACTIONS)).toEqual({
      console: "p",
      help: "?",
      menu: "q",
    });
  });

  it("lets a saved binding win", () => {
    const map = resolveKeymap({ console: "c" }, ACTIONS);
    expect(map.console).toBe("c");
    expect(map.help).toBe("?");
  });

  it("treats an emptied binding as 'back to the default'", () => {
    // `""` means cleared — a space is a real key and must survive.
    expect(resolveKeymap({ console: "" }, ACTIONS).console).toBe("p");
    expect(resolveKeymap({ console: " " }, ACTIONS).console).toBe(" ");
  });

  it("ignores saved actions that no longer exist", () => {
    // A plugin that was uninstalled must not leave a phantom action behind.
    const map = resolveKeymap({ ghost: "g" }, ACTIONS);
    expect(map).not.toHaveProperty("ghost");
  });

  it("covers an action a plugin added later", () => {
    const extended = [
      ...ACTIONS,
      { id: "codex", labelKey: "k.codex", defaultKey: "c" },
    ];
    expect(resolveKeymap({}, extended).codex).toBe("c");
  });
});

describe("findConflicts", () => {
  it("is empty when every key is unique", () => {
    expect(
      findConflicts(ACTIONS, resolveKeymap(undefined, ACTIONS)),
    ).toEqual({});
  });

  it("names both sides of a clash", () => {
    const keymap = resolveKeymap({ help: "p" }, ACTIONS);
    expect(findConflicts(ACTIONS, keymap)).toEqual({
      console: ["help"],
      help: ["console"],
    });
  });

  it("reports a three-way clash for each participant", () => {
    const keymap = { console: "x", help: "x", menu: "x" };
    expect(findConflicts(ACTIONS, keymap).console.sort()).toEqual(["help", "menu"]);
  });

  it("never reports an action against itself, and skips empty keys", () => {
    const keymap = { console: "p", help: "p", menu: "" };
    const conflicts = findConflicts(ACTIONS, keymap);
    expect(conflicts.console).toEqual(["help"]);
    expect(conflicts).not.toHaveProperty("menu");
  });
});

describe("KeyActionRegistry", () => {
  it("falls back to the built-ins when no plugin offered any", () => {
    // A player who disabled the keybindings plugin must still be able to open
    // the console and get back in.
    const registry = new KeyActionRegistry();
    expect(registry.effective().map((a) => a.id)).toEqual(
      KeyActionRegistry.DEFAULTS.map((a) => a.id),
    );
  });

  it("lists what is installed once something registers", () => {
    const registry = new KeyActionRegistry();
    registry.set("console", { id: "console", labelKey: "k", defaultKey: ";" });
    expect(registry.effective().map((a) => a.id)).toEqual(["console"]);
  });
});

describe("case-insensitive collisions", () => {
  it("flags `s` against `S`, because both are bound at runtime", () => {
    // bindingsFor("s") claims "s" *and* "S", so two actions on those keys are
    // the same shortcut — the collision the warning exists to catch.
    const actions: KeyAction[] = [
      { id: "a", labelKey: "a", defaultKey: "s" },
      { id: "b", labelKey: "b", defaultKey: "S" },
    ];
    expect(findConflicts(actions, { a: "s", b: "S" })).toEqual({
      a: ["b"],
      b: ["a"],
    });
  });

  it("leaves named keys case-sensitive-compatible", () => {
    const actions: KeyAction[] = [
      { id: "a", labelKey: "a", defaultKey: "pageup" },
      { id: "b", labelKey: "b", defaultKey: "pagedown" },
    ];
    expect(findConflicts(actions, { a: "pageup", b: "pagedown" })).toEqual({});
  });
});
