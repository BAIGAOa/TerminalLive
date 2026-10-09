import vm from "node:vm";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import * as React from "react";
import * as Ink from "ink";
import * as InkCartridge from "ink-cartridge";
import type { ExecutionMode } from "./trust.js";

/**
 * Evaluating a plugin entry file.
 *
 * Two modes, one shape (CommonJS: `module.exports` / `exports` / `__filename`):
 *
 * - **sandboxed** — a `node:vm` context with a whitelisted `require`.
 * - **trusted** — plain host evaluation with a real `require` rooted at the
 *   plugin folder. Needed by plugins that subclass game classes, use private
 *   fields, or load native modules; the sandbox's separate realm breaks
 *   `instanceof` and class identity, which deep extensions depend on.
 *
 * The sandbox is defence-in-depth for a single-player game, NOT a security
 * boundary: the host must inject `require` and live game objects for a plugin to
 * do anything useful, so a determined plugin reaches the host realm anyway
 * (`require.constructor.constructor("return process")()`). Trust is therefore a
 * policy the user states out loud — see `trust.ts` — instead of a promise the
 * kernel cannot keep.
 */

/**
 * Modules a plugin entry may `require`, as the *host's own instances*.
 *
 * Handing over the same module objects the game uses is not a convenience: a
 * plugin that rendered with its own copy of React would produce elements from a
 * different library instance, and Ink's reconciler would reject them. It also
 * sidesteps a hard limit — Ink 8 is ESM-only, so `createRequire` cannot load it
 * at all, and a sandboxed plugin has no `import()` to fall back on.
 */
/**
 * The modules as a plugin's `require` sees them.
 *
 * React is unwrapped to its default export because that is the whole library
 * and it is what `require("react")` has always returned — `React.createElement`
 * has to be on it directly. Ink's default export is just `render`, so its
 * namespace is the module object instead; unwrapping it blindly would hand
 * plugins a function with no `Box` on it.
 */
const SHARED_MODULES: Record<string, unknown> = {
  react: (React as { default?: unknown }).default ?? React,
  ink: Ink,
  "ink-cartridge": InkCartridge,
};

/** Packages a sandboxed plugin entry is allowed to `require`. */
export const SANDBOX_ALLOWED_MODULES = new Set(Object.keys(SHARED_MODULES));

/**
 * Evaluation time limit for a plugin entry. `node:vm` cannot interrupt an async
 * loop or cap memory, but this stops a synchronous `while(true){}` in the module
 * body from hanging the whole game.
 */
export const PLUGIN_EVAL_TIMEOUT_MS = 5_000;

export interface EvaluateOptions {
  /** Path used for stack traces and `__filename`/`__dirname`. */
  filename: string;
  /** `sandbox` (vm) or `host` (trusted, full access). */
  mode: ExecutionMode;
  /** Extra values injected as sandbox globals. Ignored in host mode. */
  globals?: Record<string, unknown>;
  /** Override the module-evaluation timeout (tests use a tiny value). */
  timeoutMs?: number;
}

/** Evaluate a plugin entry file and return its exports. */
export function evaluatePluginEntry(
  source: string,
  options: EvaluateOptions,
): unknown {
  return options.mode === "host"
    ? evaluateTrusted(source, options.filename)
    : evaluateSandboxed(source, options);
}

/**
 * Evaluate inside an isolated V8 context.
 *
 * The sandbox exposes `module`/`exports`/`require`/`console` and nothing else:
 * `process`, `global`, `Buffer`, `require("fs")`, `child_process`, etc. are all
 * unavailable because a `node:vm` context only carries ECMAScript built-ins.
 */
export function evaluateSandboxed(
  source: string,
  options: Omit<EvaluateOptions, "mode">,
): unknown {
  const filename = options.filename;
  const mod = { exports: {} as unknown };

  const restrictedRequire = (id: string): unknown => {
    const shared = SHARED_MODULES[id];
    if (shared === undefined) {
      throw new Error(
        `插件不允许加载模块 "${id}"（白名单：${[...SANDBOX_ALLOWED_MODULES].join(", ")}）`,
      );
    }
    return shared;
  };

  const sandbox: Record<string, unknown> = {
    module: mod,
    exports: mod.exports,
    console,
    require: restrictedRequire,
    __filename: filename,
    __dirname: dirname(filename),
    ...options.globals,
  };
  vm.createContext(sandbox);

  // Define AND invoke the wrapper in a single evaluated script. `timeout` only
  // governs code run by `runInContext` itself — it does NOT cover a context
  // function invoked later from the host, so a `while(true){}` in the module
  // body would hang forever if we returned the function and called it outside.
  const script =
    `(function (exports, require, module, __filename, __dirname) {\n${source}\n})` +
    `(module.exports, require, module, __filename, __dirname);`;
  vm.runInContext(script, sandbox, {
    filename,
    timeout: options.timeoutMs ?? PLUGIN_EVAL_TIMEOUT_MS,
  });
  return mod.exports;
}

/**
 * Evaluate as trusted code: the host realm, a real `require` resolved from the
 * plugin's own folder, and no timeout. Same CommonJS shape as the sandbox, so a
 * plugin can move between modes without changing a line.
 */
export function evaluateTrusted(source: string, filename: string): unknown {
  const mod = { exports: {} as unknown };
  const hostPluginRequire = createRequire(filename);
  // Shared modules still come from the host — a plugin must render with the
  // game's React, and ESM-only Ink cannot be `require`d at all.
  const pluginRequire = ((id: string) =>
    SHARED_MODULES[id] ?? hostPluginRequire(id)) as NodeJS.Require;
  Object.assign(pluginRequire, hostPluginRequire);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const wrapper = new Function(
    "exports",
    "require",
    "module",
    "__filename",
    "__dirname",
    source,
  ) as (
    exports: unknown,
    require: NodeJS.Require,
    module: { exports: unknown },
    filename: string,
    dirname: string,
  ) => void;

  wrapper(mod.exports, pluginRequire, mod, filename, dirname(filename));
  return mod.exports;
}
