import { describe, it, expect } from "vitest";
import { AXIS_COLOR, CLASS_COLOR } from "../../ui/gameStatus/palettes.js";

describe("status-view palettes", () => {
  it("maps every karma axis to a color", () => {
    expect(AXIS_COLOR.benevolence).toBe("green");
    expect(AXIS_COLOR.ambition).toBe("yellow");
    expect(AXIS_COLOR.wisdom).toBe("cyan");
    expect(AXIS_COLOR.rebellion).toBe("magenta");
  });

  it("maps known pressure classes and leaves unknown ones to the caller", () => {
    expect(CLASS_COLOR.nature).toBe("green");
    expect(CLASS_COLOR.meta).toBe("whiteBright");
    expect(CLASS_COLOR.unknown).toBeUndefined();
  });
});
