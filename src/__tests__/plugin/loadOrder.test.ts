import { describe, it, expect } from "vitest";
import { resolveLoadOrder } from "../../core/plugin/loadOrder.js";
import { pluginManifestSchema } from "../../core/plugin/manifest.js";
import type { PluginRef } from "../../core/plugin/manifest.js";

function mk(id: string, deps: string[] = []): PluginRef {
  const dependencies = Object.fromEntries(deps.map((d) => [d, "*"]));
  const manifest = pluginManifestSchema.parse({ name: id, dependencies });
  return { dirName: id, id, dir: `/mods/${id}`, source: "mod", manifest: { ...manifest, id } };
}

describe("mod load order", () => {
  it("loads dependencies first", () => {
    const { order, skipped } = resolveLoadOrder([mk("A", ["B"]), mk("B")]);
    expect(order.map((m) => m.id)).toEqual(["B", "A"]);
    expect(skipped).toEqual([]);
  });

  it("orders a longer chain", () => {
    const { order } = resolveLoadOrder([mk("C", ["B"]), mk("B", ["A"]), mk("A")]);
    expect(order.map((m) => m.id)).toEqual(["A", "B", "C"]);
  });

  it("skips a mod whose dependency is missing", () => {
    const { order, skipped } = resolveLoadOrder([mk("A", ["ghost"])]);
    expect(order).toEqual([]);
    expect(skipped.some((s) => s.dirName === "A")).toBe(true);
  });

  it("skips mods on a dependency cycle", () => {
    const { order, skipped } = resolveLoadOrder([mk("A", ["B"]), mk("B", ["A"])]);
    expect(order).toEqual([]);
    expect(skipped.map((s) => s.dirName).sort()).toEqual(["A", "B"]);
  });

  it("skips duplicate ids", () => {
    const { order, skipped } = resolveLoadOrder([mk("A"), mk("A")]);
    expect(order.map((m) => m.id)).toEqual(["A"]);
    expect(skipped.some((s) => s.reason.includes("重复"))).toBe(true);
  });
});

describe("plugin manifest schema", () => {
  it("applies sensible defaults", () => {
    const m = pluginManifestSchema.parse({ name: "Cool Mod" });
    expect(m.main).toBe("index.js");
    expect(m.version).toBe("0.0.0");
    expect(m.dependencies).toEqual({});
  });

  it("keeps declared dependencies", () => {
    const m = pluginManifestSchema.parse({
      name: "X",
      id: "x",
      dependencies: { core: "^1.0.0" },
    });
    expect(m.id).toBe("x");
    expect(m.dependencies.core).toBe("^1.0.0");
  });
});
