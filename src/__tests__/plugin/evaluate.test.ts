import { describe, it, expect } from "vitest";
import React from "react";
import { evaluateSandboxed, evaluateTrusted } from "../../core/plugin/evaluate.js";

const opts = { filename: "/tmp/mod/index.js" };

describe("plugin evaluation (sandbox)", () => {
  it("evaluates a CommonJS entry and returns its exports", () => {
    const out = evaluateSandboxed(
      `module.exports = { id: "demo", value: 41 + 1 };`,
      opts,
    ) as { id: string; value: number };
    expect(out.id).toBe("demo");
    expect(out.value).toBe(42);
  });

  it("captures reassigned module.exports", () => {
    const out = evaluateSandboxed(
      `exports.a = 1; module.exports = { a: 2, b: 3 };`,
      opts,
    ) as { a: number; b: number };
    expect(out).toEqual({ a: 2, b: 3 });
  });

  it("does not leak process / global / Buffer", () => {
    const out = evaluateSandboxed(
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
      evaluateSandboxed(`require("fs");`, opts),
    ).toThrow(/白名单/);
    expect(() =>
      evaluateSandboxed(`require("child_process");`, opts),
    ).toThrow(/白名单/);
  });

  it("surfaces syntax errors from the mod source", () => {
    try {
      evaluateSandboxed(`this is not js`, { filename: "/mods/broken/index.js" });
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
      evaluateSandboxed(`while (true) {}`, { ...opts, timeoutMs: 50 }),
    ).toThrow();
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it("exposes __filename and __dirname", () => {
    const out = evaluateSandboxed(
      `module.exports = { file: __filename, dir: __dirname };`,
      opts,
    ) as { file: string; dir: string };
    expect(out.file).toBe("/tmp/mod/index.js");
    expect(out.dir).toBe("/tmp/mod");
  });

  it("hands over the host's own React and Ink, not a second copy", () => {
    // Ink 8 is ESM-only, so `createRequire` cannot load it at all — and a
    // plugin rendering with its own React would produce elements the game's
    // reconciler rejects. Both are avoided by injecting the host's instances.
    const out = evaluateSandboxed(
      `const React = require("react");
       const ink = require("ink");
       module.exports = {
         isHostReact: React === globalThis.__hostReact,
         hasBox: ink.Box !== undefined,
         hasRender: typeof ink.render === "function",
         created: React.createElement("div", null).type,
       };`,
      { ...opts, globals: { __hostReact: (React as any).default ?? React } },
    ) as {
      isHostReact: boolean;
      hasBox: boolean;
      hasRender: boolean;
      created: string;
    };

    expect(out.isHostReact).toBe(true);
    expect(out.hasBox).toBe(true);
    expect(out.hasRender).toBe(true);
    expect(out.created).toBe("div");
  });
});

describe("plugin evaluation (trusted)", () => {
  it("reaches the host realm, which the sandbox cannot", () => {
    const out = evaluateTrusted(
      `module.exports = {
         process: typeof process,
         buffer: typeof Buffer,
         cwd: process.cwd(),
       };`,
      "/mods/deep/index.js",
    ) as { process: string; buffer: string; cwd: string };

    expect(out.process).toBe("object");
    expect(out.buffer).toBe("function");
    expect(typeof out.cwd).toBe("string");
  });

  it("subclasses host classes and passes instanceof", () => {
    // The reason deep plugins need full trust: a vm realm breaks class
    // identity, so `instanceof` against a game class would be false there.
    // `new Function` bodies see globals only, hence the global handoff.
    class Base {
      hello(): string {
        return "base";
      }
    }
    (globalThis as unknown as Record<string, unknown>).__pluginTestBase = Base;
    try {
      const out = evaluateTrusted(
        `module.exports = { sub: class extends __pluginTestBase { hello() { return "sub"; } } };`,
        "/mods/deep/index.js",
      ) as { sub: new () => Base };

      const instance = new out.sub();
      expect(instance.hello()).toBe("sub");
      expect(instance instanceof Base).toBe(true);
    } finally {
      delete (globalThis as unknown as Record<string, unknown>).__pluginTestBase;
    }
  });

  it("still gets the host's shared modules", () => {
    const out = evaluateTrusted(
      `module.exports = { react: require("react") };`,
      "/mods/deep/index.js",
    ) as { react: unknown };
    expect(out.react).toBe((React as any).default ?? React);
  });
});
