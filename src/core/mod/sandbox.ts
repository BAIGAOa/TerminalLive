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
  /** Override the module-evaluation timeout (tests use a tiny value). */
  timeoutMs?: number;
}

/**
 * Evaluation time limit for a mod's entry file. `node:vm` cannot interrupt an
 * async loop or cap memory, but this stops a synchronous `while(true){}` in the
 * module body from hanging the whole game.
 */
const MOD_EVAL_TIMEOUT_MS = 5_000;

/**
 * Evaluate a mod's CommonJS entry inside an isolated V8 context.
 *
 * The sandbox exposes `module`/`exports`/`require`/`console` and nothing else:
 * `process`, `global`, `Buffer`, `require("fs")`, `child_process`, etc. are all
 * unavailable because a `node:vm` context only carries ECMAScript built-ins.
 *
 * This is defence-in-depth for a single-player game, NOT a security boundary.
 * Because the host MUST inject `require` and the live game objects for a mod to
 * do anything useful, a determined mod can still reach the host realm via
 * `require.constructor.constructor("return process")()`. This is unavoidable
 * without moving plugins to a worker/child process — which is incompatible with
 * mods registering in-process Ink components. Only ever install mods you trust.
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

  // Define AND invoke the wrapper in a single evaluated script. `timeout` only
  // governs code run by `runInContext` itself — it does NOT cover a context
  // function invoked later from the host, so a `while(true){}` in the module
  // body would hang forever if we returned the function and called it outside.
  const script =
    `(function (exports, require, module, __filename, __dirname) {\n${source}\n})` +
    `(module.exports, require, module, __filename, __dirname);`;
  vm.runInContext(script, sandbox, {
    filename,
    timeout: options.timeoutMs ?? MOD_EVAL_TIMEOUT_MS,
  });
  return mod.exports;
}
