import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

/** Absolute path to the shipped `resource/` directory (works from src and dist). */
export const RESOURCE_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "resource",
);

/** The user's home, where every writable game folder lives. */
export const HOME_DIR = homedir();

/** Where user mods live. */
export const MOD_ROOT_DIR = join(HOME_DIR, ".mod_live");

/** Where plugins persist their own state (`storage` capability). */
export const PLUGIN_DATA_ROOT = join(HOME_DIR, ".plugin_data");

export function resourcePath(...parts: string[]): string {
  return join(RESOURCE_ROOT, ...parts);
}
