import { describe, it, expect } from "vitest";
import { buildNarrative, NarrativeState } from "../../world/narrative/compose.js";

function state(over: Partial<NarrativeState> = {}): NarrativeState {
  return {
    year: 3,
    eraId: "era_1",
    regionId: "reg_1",
    weatherId: "weather_clear",
    season: "spring",
    karma: { benevolence: 0, ambition: 0, wisdom: 0, rebellion: 0 },
    pressures: [{ id: "pr_unrest", cls: "society", value: 70 }],
    mood: "content",
    ...over,
  };
}

describe("buildNarrative", () => {
  it("emits weather/era/region/pressure/mood/close beats", () => {
    const keys = buildNarrative(state()).map((s) => s.key);
    expect(keys[0]).toBe("narr.scene.weather_clear");
    expect(keys).toContain("narr.era.era_1");
    expect(keys.some((k) => k.startsWith("narr.mood."))).toBe(true);
    expect(keys.some((k) => k.startsWith("narr.close."))).toBe(true);
  });

  it("adds exactly one recall beat when memory is present", () => {
    const keys = buildNarrative(
      state({ memory: { recentEvents: ["A storm came"] } }),
    ).map((s) => s.key);
    expect(keys.filter((k) => k.startsWith("narr.recall."))).toHaveLength(1);
  });

  it("adds no recall beat without memory", () => {
    const keys = buildNarrative(state()).map((s) => s.key);
    expect(keys.some((k) => k.startsWith("narr.recall."))).toBe(false);
  });

  it("is deterministic for a given state", () => {
    const m = {
      recentEvents: ["x"],
      topNpc: "Mom",
      topNpcAffinity: 70,
      career: "Teacher",
      careerRank: 2,
      arc: "The Scholar",
    };
    const a = buildNarrative(state({ memory: m })).map((s) => s.key + JSON.stringify(s.params));
    const b = buildNarrative(state({ memory: m })).map((s) => s.key + JSON.stringify(s.params));
    expect(a).toEqual(b);
  });
});
