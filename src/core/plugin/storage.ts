import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

/**
 * Per-plugin persistent storage — the "storage" capability.
 *
 * A plugin gets one JSON document under `~/.plugin_data/<id>/state.json` and the
 * kernel handles reading, writing and namespacing. Plugins never see a path, so
 * they cannot wander outside their own slot.
 *
 * Reads are best-effort: a missing or corrupt file yields the default rather
 * than throwing at boot. Writes are synchronous and atomic-enough for a
 * single-process game (write to a temp file, then rename over the target).
 */
export interface PluginStorage {
  /** Read the plugin's document, or `fallback` when nothing is stored yet. */
  read<T>(fallback: T): T;
  /** Replace the plugin's document. */
  write(value: unknown): void;
  /** Read, transform and write in one step. Returns the stored value. */
  update<T>(fn: (current: T) => T, fallback: T): T;
  /** Forget everything this plugin stored. */
  clear(): void;
}

/** Where plugin state lives, so tests and the game agree on one path. */
export function pluginDataDir(root: string, id: string): string {
  // The id comes from a manifest, so it is attacker-controlled input. Dropping
  // separators already keeps it to one segment; the remaining hole is a segment
  // made of nothing but dots — `join(root, "..")` walks out of `~/.plugin_data`
  // into the home directory.
  const cleaned = id.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(root, /^\.+$/.test(cleaned) ? "_" : cleaned);
}

function statePath(root: string, id: string): string {
  return join(pluginDataDir(root, id), "state.json");
}

/**
 * A storage handle for one plugin.
 *
 * Everything closes over `file`/`dir` rather than using `this`: a plugin that
 * writes `const { update } = ctx.storage` is doing something ordinary, and
 * `this` would be `undefined` the moment it calls it.
 */
export function createPluginStorage(root: string, id: string): PluginStorage {
  const dir = pluginDataDir(root, id);
  const file = statePath(root, id);

  const read = <T>(fallback: T): T => {
    try {
      if (!existsSync(file)) return fallback;
      return JSON.parse(readFileSync(file, "utf-8")) as T;
    } catch {
      return fallback;
    }
  };

  const write = (value: unknown): void => {
    try {
      mkdirSync(dir, { recursive: true });
      const tmp = `${file}.tmp`;
      writeFileSync(tmp, JSON.stringify(value, null, 2), "utf-8");
      // Rename over the target so a crash mid-write cannot truncate it.
      renameSync(tmp, file);
    } catch (err) {
      console.error(`[plugin:${id}] 写入存储失败:`, (err as Error).message);
    }
  };

  return {
    read,
    write,
    update<T>(fn: (current: T) => T, fallback: T): T {
      const next = fn(read(fallback));
      write(next);
      return next;
    },
    clear: () => write({}),
  };
}
