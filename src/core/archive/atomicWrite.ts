import { existsSync, renameSync, rmSync, writeFileSync } from "node:fs";

/** Per-call suffix so overlapping writers never share one temp path. */
let tmpSeq = 0;

/**
 * Crash-safe file replacement: write to a sibling temp file, then rename over
 * the target. `rename` is atomic within a filesystem, so a crash mid-write can
 * never leave a truncated JSON blob where a previous good save used to be.
 */
export function atomicWriteFileSync(file: string, data: string): void {
  const tmp = `${file}.tmp-${process.pid}-${tmpSeq++}`;
  try {
    writeFileSync(tmp, data, "utf8");
    renameSync(tmp, file);
  } catch (err) {
    // Don't leave a stray temp file behind if the write/rename failed.
    try {
      rmSync(tmp, { force: true });
    } catch {
      /* best effort */
    }
    throw err;
  }
}

/** Atomic JSON write with 2-space indentation (the project's save format). */
export function atomicWriteJsonSync(file: string, data: unknown): void {
  atomicWriteFileSync(file, JSON.stringify(data, null, 2));
}

/**
 * Move a file aside under a unique `.corrupt-<ts>` name instead of deleting it.
 * Used when a save fails to parse: the player's data is preserved for manual
 * recovery rather than silently destroyed. Returns the new path, or null.
 */
export function quarantineFileSync(file: string): string | null {
  if (!existsSync(file)) return null;
  const dest = `${file}.corrupt-${Date.now()}`;
  try {
    renameSync(file, dest);
    return dest;
  } catch {
    return null;
  }
}
