import { describe, it, expect } from "vitest";
import { describeCondition } from "../../world/conditionText.js";
import GeneralPurpose from "../../worlds/conditions/GeneralPurpose.js";
import WorldCondition from "../../worlds/WorldCondition.js";

const t = (key: string) => `T:${key}`;

class WeirdCondition extends WorldCondition {
  public customsClearance(): boolean {
    return true;
  }
}

describe("describeCondition", () => {
  it("formats a GeneralPurpose condition as `prop > n`", () => {
    const cond = new GeneralPurpose({
      prop: "health",
      num: 50,
      cat: "greaterThan",
    });
    expect(describeCondition(cond, t)).toEqual({
      known: true,
      description: "T:playerConfig.attr.health > 50",
    });
  });

  it("uses `<` for a lessThan condition", () => {
    const cond = new GeneralPurpose({
      prop: "money",
      num: 10,
      cat: "lessThan",
    });
    expect(describeCondition(cond, t)).toEqual({
      known: true,
      description: "T:playerConfig.attr.money < 10",
    });
  });

  it("reports an unknown subclass by its constructor name", () => {
    expect(describeCondition(new WeirdCondition(), t)).toEqual({
      known: false,
      typeName: "WeirdCondition",
    });
  });
});
