/**
 * Save-schema migration chain. A raw saved blob (any older version) is walked
 * forward through ordered migrations until it matches the current version, so
 * new fields can be added without breaking existing saves. Pure and testable.
 */

export type RawSave = Record<string, unknown>;

export const SAVE_VERSION = 7;

export interface Migration {
  /** Version this migration produces. */
  to: number;
  up: (raw: RawSave) => RawSave;
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export const MIGRATIONS: Migration[] = [
  {
    // v5 → v6: the RPG subsystems (economy/health/politics/regions/chains/
    // narrative/career/npcSim) were introduced; blank blobs so parsing fills
    // their defaults rather than failing.
    to: 6,
    up: (raw) => {
      const out = { ...raw };
      // The new subsystems (economy/health/politics/regions/chains/narrative/
      // career/npcSim) are left absent so the schema fills their defaults.
      if (out.levelObjectives === undefined) {
        out.levelObjectives = { levelId: null, completed: [] };
      }
      const config = asObject(out.config);
      if (!Array.isArray(config.traits)) out.config = { ...config, traits: [] };
      return out;
    },
  },
  {
    // v6 → v7: "levels" became "worlds" — one world = one entire life. The old
    // multi-stage chain progress can't map to the new model, so it is dropped;
    // the world identity guard in SaveCodec refuses a mismatched world and the
    // player starts a fresh life instead.
    to: 7,
    up: (raw) => {
      const out = { ...raw };
      delete out.levels;
      delete out.levelObjectives;
      if (out.run === undefined) out.run = { worldId: null, worldContentVersion: 1 };
      if (out.worldObjectives === undefined) {
        out.worldObjectives = { worldId: null, completed: [] };
      }
      return out;
    },
  },
];

/**
 * Walk a raw save forward to the current version. A save from a NEWER version
 * is refused rather than silently stamped down (which would drop fields the
 * current build doesn't understand).
 */
export function migrateSave(raw: RawSave): RawSave {
  const startVersion = typeof raw.version === "number" ? raw.version : 1;
  if (startVersion > SAVE_VERSION) {
    throw new Error(
      `存档版本 ${startVersion} 高于当前支持的 ${SAVE_VERSION}，无法加载`,
    );
  }
  let version = startVersion;
  let out = raw;
  for (const m of [...MIGRATIONS].sort((a, b) => a.to - b.to)) {
    if (version < m.to) {
      out = m.up(out);
      version = m.to;
    }
  }
  out.version = SAVE_VERSION;
  return out;
}
