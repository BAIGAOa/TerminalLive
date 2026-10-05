import { describe, it, expect, beforeEach } from "vitest";
import { container } from "../../Container.js";
import SeededRandom from "../../core/random/SeededRandom.js";
import Weather from "../../content/Weather.js";
import WeatherRegistry from "../../world/weather/WeatherRegistry.js";
import WeatherState from "../../world/weather/WeatherState.js";
import { seasonOf } from "../../world/weather/WeatherDefinition.js";
import WeatherFilter, {
  weatherBiasFactor,
} from "../../world/weather/WeatherFilter.js";
import PressureState from "../../world/pressures/PressureState.js";
import PressureLoader from "../../world/pressures/PressureLoader.js";
import FilterContext from "../../event/FilterContext.js";
import { Incident } from "../../world/Incident.js";

beforeEach(() => {
  Weather.load();
  container.resolve(PressureLoader).loadBuiltin();
});

describe("weather", () => {
  it("registers 8 states with per-turn grips", () => {
    const reg = container.resolve(WeatherRegistry);
    expect(reg.getStates().length).toBe(8);
    expect(reg.getState("weather_snow")?.perTurn?.health).toBe(-0.5);
  });

  it("maps a year to a season", () => {
    expect(seasonOf(0)).toBe("spring");
    expect(seasonOf(1)).toBe("summer");
    expect(seasonOf(2)).toBe("autumn");
    expect(seasonOf(3)).toBe("winter");
    expect(seasonOf(4)).toBe("spring");
  });

  it("transitions deterministically given a fixed rand", () => {
    const w = new WeatherState();
    w.set("weather_rain");
    const res = w.advance(0, "temperate", null, () => 0); // first candidate
    expect(w.currentIdValue()).toBe("weather_cloudy");
    expect(res.changed).toBe("weather_cloudy");
  });

  it("stays on a registered state across many years", () => {
    const w = new WeatherState();
    const reg = container.resolve(WeatherRegistry);
    const rng = new SeededRandom(4242);
    for (let y = 0; y < 40; y++) {
      w.advance(y, "polar", null, () => rng.next());
      expect(reg.getState(w.currentIdValue())).toBeDefined();
    }
  });

  it("the hidden scores bias the draw (calamity favours storms)", () => {
    const reg = container.resolve(WeatherRegistry);
    const draw = (pressureFactorOn: boolean) => {
      const w = new WeatherState();
      w.set("weather_cloudy");
      const p = new PressureState();
      if (pressureFactorOn) p.set("pr_calamity", 100);
      w.advance(0, "temperate", p, () => 0.8);
      return w.currentIdValue();
    };
    const normal = draw(false);
    const stormy = draw(true);
    // Same random draw, different pressure → different weather.
    expect(stormy).not.toBe(normal);
    expect(reg.getState(stormy)).toBeDefined();
  });

  it("perTurn reflects the current weather", () => {
    const w = new WeatherState();
    w.set("weather_heat");
    expect(w.perTurn().happiness).toBe(-0.6);
  });

  it("round-trips through a snapshot", () => {
    const w = new WeatherState();
    w.set("weather_fog");
    const snap = w.snapshot();
    const w2 = new WeatherState();
    w2.restore(snap);
    expect(w2.currentIdValue()).toBe("weather_fog");
  });
});

describe("weather gate + bias", () => {
  function ctx(incident: Incident, w: WeatherState): FilterContext {
    return {
      incident,
      rangeKey: "0-100",
      triggeredHistory: new Set(),
      blockedHistory: new Set(),
      rangeHistory: new Map(),
      weather: w,
    };
  }
  const mk = (extra: Record<string, unknown>) => extra as unknown as Incident;

  it("gate only matches the exact weather", () => {
    const w = new WeatherState();
    w.set("weather_storm");
    const f = new WeatherFilter();
    expect(
      f.isEligible(ctx(mk({ weatherGate: { weather: "weather_storm" } }), w)),
    ).toBe(true);
    expect(
      f.isEligible(ctx(mk({ weatherGate: { weather: "weather_clear" } }), w)),
    ).toBe(false);
  });

  it("bias multiplies only for the matching weather", () => {
    const bias = [{ weather: "weather_rain", factor: 3 }];
    expect(weatherBiasFactor(bias, "weather_rain")).toBe(3);
    expect(weatherBiasFactor(bias, "weather_clear")).toBe(1);
  });
});
