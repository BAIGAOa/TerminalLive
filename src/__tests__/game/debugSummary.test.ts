import { describe, it, expect } from "vitest";
import { formatDebugSummary } from "../../game/debugSummary.js";

describe("formatDebugSummary", () => {
  it("renders one labelled line per subsystem", () => {
    const lines = formatDebugSummary({
      player: "Mike",
      age: 40,
      year: 40,
      era: "era_2",
      region: "reg_1",
      generation: 3,
      cash: 123,
      netWorth: 4567,
      wellbeing: 60,
      expectancy: 78,
      tension: 55.4,
      order: 42,
      marketBias: -0.03,
      factions: 4,
      arcs: 2,
      chains: ["chain_war"],
    });
    expect(lines).toHaveLength(6);
    expect(lines[0]).toContain("Mike");
    expect(lines[2]).toContain("$123");
    expect(lines[3]).toContain("wellbeing=60");
    expect(lines[5]).toContain("chain_war");
  });

  it("prints a dash when no chains are active", () => {
    const lines = formatDebugSummary({
      player: "x",
      age: 1,
      year: 1,
      era: "",
      region: "",
      generation: 1,
      cash: 0,
      netWorth: 0,
      wellbeing: 0,
      expectancy: 40,
      tension: 0,
      order: 0,
      marketBias: 0,
      factions: 0,
      arcs: 0,
      chains: [],
    });
    expect(lines[5]).toContain("-");
  });
});
