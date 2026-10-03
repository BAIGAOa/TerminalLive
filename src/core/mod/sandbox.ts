import vm from "node:vm";
import { createRequire } from "node:module";
import { dirname } from "node:path";

/** Packages a mod entry file is allowed to `require`. */
const ALLOWED_MODULES = new Set(["react", "ink", "ink-cartridge"]);

const hostRequire = createRequire(import.meta.url);

export interface SandboxOptions {
  /** Path used for stack traces and `__filename`/`__dirname`. */
  filename: string;
  /** Extra values injected as sandbox globals (kept minimal on purpose). */
  globals?: Record<string, unknown>;
}

/**
 * Evaluate a mod's CommonJS entry inside an isolated V8 context.
 *
 * The sandbox exposes `module`/`exports`/`require`/`console` and nothing else:
 * `process`, `global`, `Buffer`, `require("fs")`, `child_process`, etc. are all
 * unavailable because a `node:vm` context only carries ECMAScript built-ins.
 *
 * This is defence-in-depth for a single-player game, NOT a security boundary —
 * a determined mod can still escape via `this.constructor.constructor`. Only
 * ever install mods you trust.
 */
export function loadModModule(
  source: string,
  options: SandboxOptions,
): unknown {
  const filename = options.filename;
  const mod = { exports: {} as unknown };

  const restrictedRequire = (id: string): unknown => {
    if (!ALLOWED_MODULES.has(id)) {
      throw new Error(`模组不允许加载模块 "${id}"（白名单：${[...ALLOWED_MODULES].join(", ")}）`);
    }
    return hostRequire(id);
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

  const wrapped = `(function (exports, require, module, __filename, __dirname) {\n${source}\n})`;
  const fn = vm.runInContext(wrapped, sandbox, { filename }) as (
    exports: unknown,
    require: (id: string) => unknown,
    module: { exports: unknown },
    __filename: string,
    __dirname: string,
  ) => void;

  fn(mod.exports, restrictedRequire, mod, filename, dirname(filename));
  return mod.exports;
}
