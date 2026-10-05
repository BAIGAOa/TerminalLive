import type { PlayerConfigType } from "../types/ConfigType.js";

/** Pure player-config metadata and validation — React-free, no DI, so the
 * editor's rules can be unit-tested without rendering. */

export enum PlayerConfigCategory {
  basic = "basic",
  physical = "physical",
  skills = "skills",
  psychological = "psychological",
  wealth = "wealth",
}

export interface PlayerAttributeMeta {
  key: keyof PlayerConfigType;
  type: "string" | "number";
  min?: number;
  max?: number;
}

export const ATTRIBUTE_META: Record<PlayerConfigCategory, PlayerAttributeMeta[]> = {
  [PlayerConfigCategory.basic]: [{ key: "playerName", type: "string" }],
  [PlayerConfigCategory.physical]: [
    { key: "age", type: "number", min: 0, max: 150 },
    { key: "health", type: "number", min: 0, max: 100 },
    { key: "height", type: "number", min: 0.5, max: 3 },
    { key: "weight", type: "number", min: 1, max: 500 },
  ],
  [PlayerConfigCategory.skills]: [
    { key: "intelligence", type: "number", min: 0, max: 100 },
    { key: "social", type: "number", min: 0, max: 100 },
    { key: "fitness", type: "number", min: 0, max: 100 },
    { key: "happiness", type: "number", min: 0, max: 100 },
    { key: "reputation", type: "number", min: 0, max: 100 },
  ],
  [PlayerConfigCategory.psychological]: [
    { key: "angerValue", type: "number", min: 0, max: 100 },
    { key: "excitationValue", type: "number", min: 0, max: 100 },
    { key: "depressionValue", type: "number", min: 0, max: 100 },
    { key: "weakValue", type: "number", min: 0, max: 100 },
  ],
  [PlayerConfigCategory.wealth]: [{ key: "money", type: "number", min: 0 }],
};

/** Look up the metadata for an attribute key (any category). */
export function getAttrMeta(key: string): PlayerAttributeMeta | undefined {
  for (const list of Object.values(ATTRIBUTE_META)) {
    const found = list.find((m) => m.key === key);
    if (found) return found;
  }
  return undefined;
}

export type ValueValidation =
  | { valid: true; value: string | number }
  | { valid: false; errorKey: string; params?: Record<string, string | number> };

/**
 * Validate a raw editor string for the attribute `key`. Returns the parsed
 * value on success, or a translation key (+ params) describing the failure —
 * the caller resolves it through `t`, so this stays i18n-agnostic and pure.
 */
export function validateValue(key: string, raw: string): ValueValidation {
  const meta = getAttrMeta(key);
  if (!meta) {
    return { valid: false, errorKey: "playerConfig.error.number" };
  }
  if (meta.type === "string") {
    if (!raw.trim()) return { valid: false, errorKey: "playerConfig.error.empty" };
    return { valid: true, value: raw.trim() };
  }
  const num = Number(raw);
  if (isNaN(num) || raw.trim() === "") {
    return { valid: false, errorKey: "playerConfig.error.number" };
  }
  if (meta.min !== undefined && num < meta.min) {
    return { valid: false, errorKey: "playerConfig.error.min", params: { n: meta.min } };
  }
  if (meta.max !== undefined && num > meta.max) {
    return { valid: false, errorKey: "playerConfig.error.max", params: { n: meta.max } };
  }
  return { valid: true, value: num };
}
