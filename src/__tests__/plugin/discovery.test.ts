import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { discoverPlugins, type PluginRootSpec } from "../../core/plugin/discovery.js";

let root: string;

const spec = (): PluginRootSpec => ({
  source: "mod",
  root,
  manifestFile: "mod.json",
  defaultEntry: "index.js",
  contentDirs: ["events", "items"],
});

/** Write `<dir>/<file>` (nesting as needed) with `contents`. */
function put(dir: string, file: string, contents: string): void {
  const target = join(root, dir, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf-8");
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "tl-plugins-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("plugin discovery", () => {
  it("returns nothing when the root does not exist", () => {
    rmSync(root, { recursive: true, force: true });
    expect(discoverPlugins(spec())).toEqual([]);
  });

  it("reads a manifest and takes its id", () => {
    put("cool", "mod.json", JSON.stringify({ id: "the.cool", name: "Cool" }));
    const [ref] = discoverPlugins(spec());
    expect(ref.id).toBe("the.cool");
    expect(ref.dirName).toBe("cool");
    expect(ref.source).toBe("mod");
    expect(ref.manifest.version).toBe("0.0.0"); // schema default
  });

  it("falls back to the folder name when the manifest has no id", () => {
    put("anon", "mod.json", JSON.stringify({ name: "Anonymous" }));
    expect(discoverPlugins(spec())[0].id).toBe("anon");
  });

  it("accepts a folder that is only an entry file, and one that is only content", () => {
    put("code", "index.js", "module.exports = {};");
    put("data", "events/a.json", "{}");
    const ids = discoverPlugins(spec())
      .map((r) => r.id)
      .sort();
    expect(ids).toEqual(["code", "data"]);
  });

  it("skips a broken manifest instead of failing the whole scan", () => {
    put("broken", "mod.json", "{ not json");
    put("ok", "mod.json", JSON.stringify({ id: "ok", name: "OK" }));
    expect(discoverPlugins(spec()).map((r) => r.id)).toEqual(["ok"]);
  });

  it("skips a manifest that does not validate", () => {
    put("bad", "mod.json", JSON.stringify({ version: 12 }));
    expect(discoverPlugins(spec())).toEqual([]);
  });

  it("ignores folders that hold nothing plugin-shaped, and hidden ones", () => {
    mkdirSync(join(root, "empty"), { recursive: true });
    put(".hidden", "mod.json", JSON.stringify({ name: "Hidden" }));
    expect(discoverPlugins(spec())).toEqual([]);
  });
});
