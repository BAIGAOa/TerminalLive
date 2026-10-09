import { describe, it, expect } from "vitest";
import {
  buildPluginView,
  togglePluginEnabled,
  toggleTrusted,
} from "../../ui/pluginManagerView.js";
import { pluginManifestSchema } from "../../core/plugin/manifest.js";
import type { PluginRef, PluginSource } from "../../core/plugin/manifest.js";
import type { PluginEnablement } from "../../core/plugin/sources.js";

function ref(
  id: string,
  source: PluginSource,
  extra: Record<string, unknown> = {},
): PluginRef {
  return {
    id,
    dirName: id,
    dir: "/x",
    source,
    manifest: pluginManifestSchema.parse({ name: id, id, ...extra }),
  };
}

const t = (key: string) => key;
const noTrust: readonly string[] = [];

describe("plugin manager view", () => {
  const refs = [
    ref("core.ui", "builtin", { nameKey: "plugin.core.statusViews.name" }),
    ref("my-mod", "mod"),
  ];

  it("translates a nameKey and falls back to the manifest name", () => {
    const view = buildPluginView(refs, { mods: [], builtins: null }, noTrust, t);
    expect(view.builtins[0].name).toBe("plugin.core.statusViews.name");
    expect(view.mods[0].name).toBe("my-mod");
  });

  it("keys a row by folder name for mods and id for shipped plugins", () => {
    const view = buildPluginView(refs, { mods: [], builtins: null }, noTrust, t);
    expect(view.builtins[0].key).toBe("core.ui");
    expect(view.mods[0].key).toBe("my-mod");
  });

  it("shows a plugin the user trusted even though it never asked", () => {
    const view = buildPluginView(refs, { mods: [], builtins: null }, ["my-mod"], t);
    expect(view.mods[0].trusted).toBe(true);
    expect(view.mods[0].requestedTrust).toBe(false);
  });

  it("shows a plugin asking for trust that is still sandboxed", () => {
    const asking = ref("deep-mod", "mod", { trust: "full" });
    const view = buildPluginView([asking], { mods: [], builtins: null }, [], t);
    expect(view.mods[0].requestedTrust).toBe(true);
    expect(view.mods[0].trusted).toBe(true); // the manifest grants it
  });
});

describe("toggling plugins", () => {
  it("turns a shipped plugin off by materialising the null 'all on' list", () => {
    // The bug worth guarding: `null` means every shipped plugin is on, so
    // switching one off must write out the rest, not just the one.
    const a = ref("a", "builtin");
    const b = ref("b", "builtin");
    // The  list means "every shipped plugin on", so the effective set is
    // a and b — turning a off leaves only b.
    const next = togglePluginEnabled(a, { mods: [], builtins: null }, ["a", "b"]);
    expect(next.builtins).toEqual(["b"]);
  });

  it("turns a shipped plugin back on", () => {
    const a = ref("a", "builtin");
    expect(
      togglePluginEnabled(a, { mods: [], builtins: ["b"] }, ["a", "b"]).builtins,
    ).toEqual(["b", "a"]);
  });

  it("toggles a mod by folder name", () => {
    const mod = ref("cool-mod", "mod");
    const off = togglePluginEnabled(mod, { mods: ["cool-mod"], builtins: null }, []);
    expect(off.mods).toEqual([]);
    const on: PluginEnablement = togglePluginEnabled(
      mod,
      { mods: [], builtins: null },
      [],
    );
    expect(on.mods).toEqual(["cool-mod"]);
  });

  it("adds and removes trust", () => {
    expect(toggleTrusted([], "a")).toEqual(["a"]);
    expect(toggleTrusted(["a", "b"], "a")).toEqual(["b"]);
  });

  it("switches a built-in feature off through the disable list", () => {
    // The game's own plugins are opt-out, so their toggle is the only list
    // that records them — writing to the shipped whitelist would do nothing.
    const feature = ref("core.status-views", "core");
    const off = togglePluginEnabled(
      feature,
      { mods: [], builtins: null, disabled: [] },
      [],
    );
    expect(off.disabled).toEqual(["core.status-views"]);
    expect(off.builtins).toBeNull(); // untouched

    const backOn = togglePluginEnabled(feature, off, []);
    expect(backOn.disabled).toEqual([]);
  });
});

describe("plugin manager grouping", () => {
  it("lists the three sources in the order they are shown", () => {
    const view = buildPluginView(
      [
        ref("my-mod", "mod"),
        ref("core.status-views", "core"),
        ref("golden_age_plugin", "builtin"),
      ],
      { mods: ["my-mod"], builtins: null },
      [],
      t,
    );
    expect(view.all.map((r) => r.key)).toEqual([
      "core.status-views",
      "golden_age_plugin",
      "my-mod",
    ]);
    expect(view.core).toHaveLength(1);
    expect(view.builtins).toHaveLength(1);
    expect(view.mods).toHaveLength(1);
  });
});

describe("toggle under a null shipped list", () => {
  it("turns an opt-in plugin ON with one press", () => {
    // `null` means "the shipped plugins the game assumes are on" — an opt-in
    // one is off under it. Listing every id on disk as the current set made
    // the first press read as "turn it off", so nothing appeared to happen.
    const hud = ref("minimal_hud", "builtin", { defaultEnabled: false });
    const normal = ref("golden_age_plugin", "builtin");

    const next = togglePluginEnabled(hud, { mods: [], builtins: null }, [normal.id]);
    expect(next.builtins).toEqual(["golden_age_plugin", "minimal_hud"]);
  });

  it("leaves an ordinary shipped plugin's toggle alone", () => {
    const normal = ref("golden_age_plugin", "builtin");
    const next = togglePluginEnabled(normal, { mods: [], builtins: null }, [normal.id]);
    expect(next.builtins).toEqual([]);
  });
});
