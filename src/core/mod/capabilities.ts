/**
 * Mod capability model. A mod declares what it needs in `mod.json`; the loader
 * only grants those powers, so a mod can't quietly read the world or register
 * UI it never asked for. Pure and testable.
 */

export const CAPABILITIES = [
  "events",
  "items",
  "npcs",
  "levels",
  "world",
  "random",
  "ui",
  "storage",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

/** Legacy mods (no declared capabilities) get the content directories only. */
export const LEGACY_CAPABILITIES: Capability[] = [
  "events",
  "items",
  "npcs",
  "levels",
];

export interface CapabilityCarrier {
  capabilities?: string[];
}

function isCapability(v: string): v is Capability {
  return (CAPABILITIES as readonly string[]).includes(v);
}

/** Normalize a declared list, dropping unknown entries. */
export function normalizeCapabilities(list: string[] | undefined): Capability[] {
  if (!list) return [...LEGACY_CAPABILITIES];
  return list.filter(isCapability);
}

export function hasCapability(
  manifest: CapabilityCarrier,
  cap: Capability,
): boolean {
  return normalizeCapabilities(manifest.capabilities).includes(cap);
}

/** Whether a mod may load a content directory of the given capability. */
export function canLoadContent(
  manifest: CapabilityCarrier,
  cap: "events" | "items" | "npcs" | "levels",
): boolean {
  return hasCapability(manifest, cap);
}
