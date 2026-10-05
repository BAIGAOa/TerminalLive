import { describe, it, expect } from "vitest";
import { loadModModule } from "../../core/mod/sandbox.js";

const opts = { filename: "/tmp/mod/index.js" };

describe("mod sandbox", () => {
  it("evaluates a CommonJS entry and returns its exports", () => {
    const out = loadModModule(
      `module.exports = { id: "demo", value: 41 + 1 };`,
      opts,
    ) as { id: string; value: number };
    expect(out.id).toBe("demo");
    expect(out.value).toBe(42);
  });

  it("captures reassigned module.exports", () => {
    const out = loadModModule(
      `exports.a = 1; module.exports = { a: 2, b: 3 };`,
      opts,
    ) as { a: number; b: number };
    expect(out).toEqual({ a: 2, b: 3 });
  });

  it("does not leak process / global / Buffer", () => {
    const out = loadModModule(
      `module.exports = {
        process: typeof process,
        global: typeof global,
        buffer: typeof Buffer,
      };`,
      opts,
    ) as Record<string, string>;
    expect(out.process).toBe("undefined");
    expect(out.global).toBe("undefined");
    expect(out.buffer).toBe("undefined");
  });

  it("rejects requires outside the whitelist", () => {
    expect(() =>
      loadModModule(`require("fs");`, opts),
    ).toThrow(/白名单/);
    expect(() =>
      loadModModule(`require("child_process");`, opts),
    ).toThrow(/白名单/);
  });

  it("surfaces syntax errors from the mod source", () => {
    try {
      loadModModule(`this is not js`, { filename: "/mods/broken/index.js" });
      throw new Error("should have thrown");
    } catch (err) {
      // Cross-realm error: check by name, not `instanceof`.
      expect((err as Error).name).toBe("SyntaxError");
    }
  });

  it("aborts a synchronous infinite loop instead of hanging", () => {
    const started = Date.now();
    // A tiny timeout keeps the test fast; production defaults to 5s.
    // `vm` reports a timeout as a thrown error (name varies by Node version).
    expect(() =>
      loadModModule(`while (true) {}`, { ...opts, timeoutMs: 50 }),
    ).toThrow();
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it("exposes __filename and __dirname", () => {
    const out = loadModModule(
      `module.exports = { file: __filename, dir: __dirname };`,
      opts,
    ) as { file: string; dir: string };
    expect(out.file).toBe("/tmp/mod/index.js");
    expect(out.dir).toBe("/tmp/mod");
  });
});
