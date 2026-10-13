import { describe, it, expect } from "vitest";
import {
  buildNarrative,
  chronicleLineKey,
  NarrativeState,
} from "../../world/narrative/compose.js";

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

  it("takes the era and region keys from the world when it is given them", () => {
    const keys = buildNarrative(
      state({ eraKey: "wilds.era.1.desc", regionKey: "wilds.reg.7.desc" }),
    ).map((s) => s.key);
    expect(keys).toContain("wilds.era.1.desc");
    expect(keys).toContain("wilds.reg.7.desc");
    // The classic convention would have produced keys no language pack has.
    expect(keys).not.toContain("narr.era.era_1");
    expect(keys).not.toContain("narr.region.reg_1");
  });

  it("falls back to the classic convention when given no world key", () => {
    const keys = buildNarrative(state()).map((s) => s.key);
    expect(keys).toContain("narr.era.era_1");
    expect(keys).toContain("narr.region.reg_1");
  });

  it("emits no era or region beat for an empty id", () => {
    const keys = buildNarrative(state({ eraId: "", regionId: "" })).map((s) => s.key);
    expect(keys.some((k) => k.startsWith("narr.era."))).toBe(false);
    expect(keys.some((k) => k.startsWith("narr.region."))).toBe(false);
  });
});

describe("chronicleLineKey", () => {
  it("prefers a line written for the scene", () => {
    expect(
      chronicleLineKey(
        { narrKey: "wilds.era.1.narr", descKey: "wilds.era.1.desc", labelKey: "wilds.era.1" },
        "narr.era.era_wilds_1",
      ),
    ).toBe("wilds.era.1.narr");
  });

  it("falls back to the description, which every world defines", () => {
    expect(
      chronicleLineKey({ descKey: "wilds.era.1.desc", labelKey: "wilds.era.1" }, "fallback"),
    ).toBe("wilds.era.1.desc");
  });

  it("falls back to the name when there is no description", () => {
    expect(chronicleLineKey({ labelKey: "wilds.era.1" }, "fallback")).toBe("wilds.era.1");
  });

  it("keeps the classic convention when the world defines nothing", () => {
    expect(chronicleLineKey(undefined, "narr.era.era_dawn")).toBe("narr.era.era_dawn");
  });
});
