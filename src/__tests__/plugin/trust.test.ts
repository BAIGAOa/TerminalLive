import { describe, it, expect } from "vitest";
import {
  partitionByTrust,
  resolveExecutionMode,
} from "../../core/plugin/trust.js";
import { pluginManifestSchema } from "../../core/plugin/manifest.js";
import type { PluginRef } from "../../core/plugin/manifest.js";

function ref(id: string, trust?: "sandbox" | "full"): PluginRef {
  return {
    id,
    dirName: id,
    dir: `/mods/${id}`,
    source: "mod",
    manifest: pluginManifestSchema.parse({ name: id, id, trust }),
  };
}

describe("plugin trust", () => {
  it("defaults to the sandbox", () => {
    expect(resolveExecutionMode(ref("a").manifest)).toBe("sandbox");
    expect(ref("a").manifest.trust).toBe("sandbox");
  });

  it("honours a manifest that asks for full access", () => {
    expect(resolveExecutionMode(ref("a", "full").manifest)).toBe("host");
  });

  it("lets the user trust a plugin that did not ask", () => {
    expect(resolveExecutionMode(ref("a").manifest, { trusted: ["a"] })).toBe("host");
    expect(resolveExecutionMode(ref("a").manifest, { trusted: ["b"] })).toBe("sandbox");
  });

  it("lets the user force everything into the sandbox", () => {
    // The escape hatch for a mod that asks for full access and should not get it.
    expect(
      resolveExecutionMode(ref("a", "full").manifest, {
        trusted: ["a"],
        forceSandbox: true,
      }),
    ).toBe("sandbox");
  });

  it("splits a load list by mode, preserving order", () => {
    const a = { ref: ref("a") };
    const b = { ref: ref("b", "full") };
    const c = { ref: ref("c") };
    const { sandboxed, trusted } = partitionByTrust([a, b, c]);
    expect(sandboxed).toEqual([a, c]);
    expect(trusted).toEqual([b]);
  });
});
