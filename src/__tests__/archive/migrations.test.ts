import { describe, it, expect } from "vitest";
import { migrateSave, SAVE_VERSION } from "../../core/archive/migrations.js";

describe("migrateSave", () => {
  it("stamps the current version", () => {
    expect(migrateSave({}).version).toBe(SAVE_VERSION);
    expect(migrateSave({ version: 5 }).version).toBe(SAVE_VERSION);
  });

  it("backfills fields older saves lack", () => {
    const out = migrateSave({ version: 5, config: { language: "en_US" } });
    // v7 replaced the multi-level chain with a single-world run.
    expect(out.worldObjectives).toEqual({ worldId: null, completed: [] });
    expect(out.run).toEqual({ worldId: null, worldContentVersion: 1 });
    expect(out.levels).toBeUndefined();
    expect((out.config as Record<string, unknown>).traits).toEqual([]);
  });

  it("preserves existing values", () => {
    const out = migrateSave({
      version: 5,
      config: { language: "zh_CN", traits: ["trait_smart"] },
      economy: { market: { year: 3 } },
    });
    expect((out.config as Record<string, unknown>).language).toBe("zh_CN");
    expect((out.config as Record<string, unknown>).traits).toEqual(["trait_smart"]);
    expect(out.economy).toEqual({ market: { year: 3 } });
  });

  it("is idempotent", () => {
    const once = migrateSave({ version: 5, config: {} });
    const twice = migrateSave(once);
    expect(twice).toEqual(once);
  });
});
