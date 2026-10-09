import { describe, it, expect } from "vitest";
import { deniedKernel } from "../../core/plugin/kernel.js";

describe("deniedKernel", () => {
  it("refuses a service by name", () => {
    const denied = deniedKernel("my-mod");
    expect(() => denied.random).toThrow(/my-mod.*kernel.*random/s);
    expect(() => denied.events()).toThrow(/kernel/);
  });

  it("survives being inspected, logged or serialised", () => {
    // The stub is handed to every plugin, including ones that never touch it.
    // A plugin that prints its context, or a devtools enumerating it, must not
    // take the screen down — only reaching for a service should fail.
    const denied = deniedKernel("my-mod");
    expect(() => String(denied)).not.toThrow();
    expect(() => JSON.stringify(denied)).not.toThrow();
    expect(() => Object.keys(denied)).not.toThrow();
    expect(denied[Symbol.for("nodejs.util.inspect.custom")]).toBeUndefined();
  });

  it("is not mistaken for a thenable", () => {
    // `then` returning a throwing getter would make `await ctx.kernel` explode
    // somewhere unrelated to the capability.
    const denied = deniedKernel("my-mod");
    expect(denied.then).toBeUndefined();
  });
});
