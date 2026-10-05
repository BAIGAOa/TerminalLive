import { resolve, sep } from "node:path";

/** Player-chosen save names must stay short, single-segment and filesystem-safe. */
export const MAX_SAVE_NAME_LENGTH = 64;

/**
 * Allowed: letters (any script, incl. CJK), digits, space, `_`, `-`, `.`.
 * The first character may not be a dot or whitespace, and the name may not be
 * empty — this rejects `.`, `..` and every path-traversal form without needing
 * to enumerate separators.
 */
const SAVE_NAME_RE = /^[^\s.][\p{L}\p{N} _.-]*$/u;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * True when `name` is safe to turn into a directory under the archive root.
 * Pure: no filesystem access, fully unit-testable.
 */
export function isValidSaveName(name: string): boolean {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SAVE_NAME_LENGTH) return false;
  if (trimmed !== name) return false; // callers should pass a pre-trimmed name
  if (!SAVE_NAME_RE.test(trimmed)) return false;
  if (RESERVED.test(trimmed)) return false;
  return true;
}

/**
 * Join `name` onto `root`, guaranteeing the result stays inside `root`.
 * Throws on traversal even if the name would otherwise be a legal segment
 * (e.g. an attacker-supplied absolute path). Use for load/delete, where the
 * name may also come from `readdir` of pre-existing folders.
 */
export function resolveWithin(root: string, name: string): string {
  const base = resolve(root);
  const target = resolve(base, name);
  // Strict containment: reject both escapes (`..`, absolute) and the root
  // itself (`.`/`..` must not resolve to the archive directory).
  if (!target.startsWith(base + sep)) {
    throw new Error(`拒绝不安全的存档名: ${JSON.stringify(name)}`);
  }
  return target;
}
