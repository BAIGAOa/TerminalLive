import { describe, it, expect } from "vitest";
import { saveDataSchema } from "../../core/archive/SaveSchema.js";

describe("SaveSchema — postEvents", () => {
  const schema = saveDataSchema.pick({ postEvents: true });

  it("defaults to an empty queue for saves written before the field existed", () => {
    expect(schema.parse({}).postEvents).toEqual([]);
  });

  it("round-trips a closure-free queue entry", () => {
    const postEvents = [
      { sourceId: "src", targetId: "t", delay: 2, edgeIndex: 1 },
      { sourceId: "src", targetId: "u", delay: 0, weight: 3 },
    ];
    expect(schema.parse({ postEvents }).postEvents).toEqual(postEvents);
  });

  it("defaults a missing delay to zero and drops unknown fields", () => {
    const parsed = schema.parse({
      postEvents: [{ sourceId: "s", targetId: "t", edge: { incident: "t" } }],
    });
    expect(parsed.postEvents).toEqual([{ sourceId: "s", targetId: "t", delay: 0 }]);
  });
});
