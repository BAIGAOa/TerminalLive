import { describe, it, expect } from "vitest";
import {
  groupBySource,
  isPluginEnabled,
  planPluginLoad,
  selectEnabledPlugins,
} from "../../core/plugin/sources.js";
import { pluginManifestSchema } from "../../core/plugin/manifest.js";
import type { PluginRef, PluginSource } from "../../core/plugin/manifest.js";

function ref(
  id: string,
  source: PluginSource,
  deps: string[] = [],
): PluginRef {
  const dependencies = Object.fromEntries(deps.map((d) => [d, "*"]));
  return {
    id,
    dirName: id,
    dir: source === "builtin" ? `/plugins/${id}` : `/mods/${id}`,
    source,
    manifest: pluginManifestSchema.parse({ name: id, id, dependencies }),
  };
}

describe("plugin enablement", () => {
  const builtin = ref("core.ui", "builtin");
  const mod = ref("my-mod", "mod");

  it("toggles shipped plugins by id and mods by folder name", () => {
    expect(isPluginEnabled(builtin, { mods: [], builtins: [] })).toBe(false);
    expect(isPluginEnabled(builtin, { mods: [], builtins: ["core.ui"] })).toBe(true);
    expect(isPluginEnabled(mod, { mods: [], builtins: null })).toBe(false);
    expect(isPluginEnabled(mod, { mods: ["my-mod"], builtins: [] })).toBe(true);
  });

  it("treats a null builtin list as 'all of them on'", () => {
    // The shipped default: plugins the game comes with are on until switched off.
    expect(isPluginEnabled(builtin, { mods: [], builtins: null })).toBe(true);
  });

  it("keeps the game's own plugins on even when the whitelist omits them", () => {
    // Regression: the stored whitelist predates any given new feature, so
    // treating `core` like a shipped content pack silently disabled every
    // feature added after the player's config was written.
    const feature = ref("core.new-feature", "core");
    const stale = { mods: [], builtins: ["core.old-pack"] };
    expect(isPluginEnabled(feature, stale)).toBe(true);
    expect(isPluginEnabled(feature, { ...stale, disabled: ["core.new-feature"] })).toBe(
      false,
    );
  });

  it("keeps discovery order in the enabled subset", () => {
    const refs = [ref("a", "builtin"), ref("b", "mod"), ref("c", "builtin")];
    const on = selectEnabledPlugins(refs, { mods: ["b"], builtins: ["a", "c"] });
    expect(on.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("groups by source for the settings screen", () => {
    const { builtins, mods } = groupBySource([
      ref("a", "builtin"),
      ref("b", "mod"),
      ref("c", "mod"),
    ]);
    expect(builtins.map((r) => r.id)).toEqual(["a"]);
    expect(mods.map((r) => r.id)).toEqual(["b", "c"]);
  });
});

describe("plugin load plan", () => {
  it("orders a mod after the shipped plugin it depends on", () => {
    // Cross-source dependencies are the point of one shared contract.
    const base = ref("base", "builtin");
    const addon = ref("addon", "mod", ["base"]);
    const { order, skipped } = planPluginLoad([addon, base], {
      mods: ["addon"],
      builtins: ["base"],
    });
    expect(order.map((r) => r.id)).toEqual(["base", "addon"]);
    expect(skipped).toEqual([]);
  });

  it("skips a plugin whose dependency is disabled", () => {
    const addon = ref("addon", "mod", ["base"]);
    const base = ref("base", "builtin");
    const { order, skipped } = planPluginLoad([addon, base], {
      mods: ["addon"],
      builtins: [], // base switched off
    });
    expect(order).toEqual([]);
    expect(skipped[0].dirName).toBe("addon");
    expect(skipped[0].reason).toContain("base");
  });
});

describe("opt-in shipped plugins", () => {
  function optIn(id: string): PluginRef {
    return {
      id,
      dirName: id,
      dir: `/plugins/${id}`,
      source: "builtin",
      manifest: pluginManifestSchema.parse({
        id,
        name: id,
        defaultEnabled: false,
      }),
    };
  }

  it("stays off when the list is absent, unlike an ordinary shipped plugin", () => {
    // The default whitelist means "every plugin the game ships is on" — but a
    // plugin that replaces a screen must not ride in on that.
    expect(isPluginEnabled(ref("ordinary", "builtin"), { mods: [], builtins: null })).toBe(true);
    expect(isPluginEnabled(optIn("hud"), { mods: [], builtins: null })).toBe(false);
  });

  it("is on once the player lists it", () => {
    expect(isPluginEnabled(optIn("hud"), { mods: [], builtins: ["hud"] })).toBe(true);
    expect(isPluginEnabled(optIn("hud"), { mods: [], builtins: ["other"] })).toBe(false);
  });
});
