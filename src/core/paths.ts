import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to the shipped `resource/` directory (works from src and dist). */
export const RESOURCE_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "resource",
);

export function resourcePath(...parts: string[]): string {
  return join(RESOURCE_ROOT, ...parts);
}
