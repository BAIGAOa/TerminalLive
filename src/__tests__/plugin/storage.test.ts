import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createPluginStorage,
  pluginDataDir,
} from "../../core/plugin/storage.js";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "tl-plugin-data-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("pluginDataDir", () => {
  it("keeps an ordinary id as-is", () => {
    expect(pluginDataDir("/data", "my-mod")).toBe("/data/my-mod");
    expect(pluginDataDir("/data", "core.status_views")).toBe(
      "/data/core.status_views",
    );
  });

  it("cannot walk out of the plugin data root", () => {
    // The id is manifest-supplied: `".."` would otherwise resolve to the
    // parent of ~/.plugin_data and the plugin would read/write ~/state.json.
    expect(pluginDataDir("/data", "..")).toBe("/data/_");
    expect(pluginDataDir("/data", ".")).toBe("/data/_");
    expect(pluginDataDir("/data", "...")).toBe("/data/_");
    // Separators are flattened, so whatever survives is one literal segment —
    // assert the property rather than the exact spelling.
    const escaped = pluginDataDir("/data", "../..");
    expect(escaped.startsWith("/data/")).toBe(true);
    expect(escaped.slice("/data/".length)).not.toContain("/");
  });

  it("flattens anything that would need a second path segment", () => {
    expect(pluginDataDir("/data", "a/b")).toBe("/data/a_b");
    expect(pluginDataDir("/data", "a\\b")).toBe("/data/a_b");
  });
});

describe("plugin storage", () => {
  it("round-trips a document", () => {
    const store = createPluginStorage(root, "mod");
    expect(store.read({ seen: 0 })).toEqual({ seen: 0 });
    store.write({ seen: 3 });
    expect(store.read({ seen: 0 })).toEqual({ seen: 3 });
  });

  it("keeps each plugin in its own file", () => {
    createPluginStorage(root, "a").write({ who: "a" });
    createPluginStorage(root, "b").write({ who: "b" });
    expect(createPluginStorage(root, "a").read({})).toEqual({ who: "a" });
    expect(existsSync(join(root, "a", "state.json"))).toBe(true);
  });

  it("survives its methods being detached", () => {
    // `const { update } = ctx.storage` is an ordinary thing for a plugin to
    // write, and `this` would be undefined when it calls it.
    const { update, read, clear } = createPluginStorage(root, "mod");
    expect(update((s: { n: number }) => ({ n: s.n + 1 }), { n: 0 })).toEqual({ n: 1 });
    expect(read({ n: 0 })).toEqual({ n: 1 });
    clear();
    expect(read({ n: 0 })).toEqual({});
  });

  it("returns the fallback for a corrupt document instead of throwing", () => {
    const store = createPluginStorage(root, "mod");
    store.write({ ok: true });
    const file = join(root, "mod", "state.json");
    writeFileSync(file, "{ not json", "utf-8");
    expect(store.read({ ok: false })).toEqual({ ok: false });
    expect(readFileSync(file, "utf-8")).toBe("{ not json");
  });
});
