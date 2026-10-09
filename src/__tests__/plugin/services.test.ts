import { describe, it, expect } from "vitest";
import { ServiceRegistry } from "../../core/plugin/services.js";

describe("plugin service registry", () => {
  it("lets one plugin hand an interface to another", () => {
    const reg = new ServiceRegistry();
    reg.forOwner("economy").provide("prices", { wheat: 3 });
    expect(reg.forOwner("farm").get<{ wheat: number }>("prices")?.wheat).toBe(3);
    expect(reg.forOwner("farm").has("prices")).toBe(true);
  });

  it("retracts only the owner's own publication", () => {
    const reg = new ServiceRegistry();
    reg.provide("theme", "from-a", "a");
    reg.provide("theme", "from-b", "b");
    reg.retract("theme", "a");
    // b still publishes it, so the service survives — with b's value, which
    // is the one that won in the first place.
    expect(reg.get("theme")).toBe("from-b");
    reg.retract("theme", "b");
    expect(reg.has("theme")).toBe(false);
  });

  it("drops everything a plugin published when it unloads", () => {
    const reg = new ServiceRegistry();
    reg.provide("a", 1, "plugin");
    reg.provide("b", 2, "plugin");
    reg.provide("c", 3, "other");
    reg.retractAll("plugin");
    expect(reg.ids()).toEqual(["c"]);
  });

  it("require() names what is missing instead of returning undefined", () => {
    const reg = new ServiceRegistry();
    const handle = reg.forOwner("needy");
    expect(() => handle.require("ghost")).toThrow(/needy.*ghost/s);
    handle.provide("ghost", 1);
    expect(handle.require<number>("ghost")).toBe(1);
  });

  it("cannot retract a service it did not publish", () => {
    const reg = new ServiceRegistry();
    reg.provide("owned", 1, "a");
    reg.retract("owned", "b");
    expect(reg.get("owned")).toBe(1);
  });
});

describe("service stacks", () => {
  it("falls back to the previous publisher when the override unloads", () => {
    // The failure this guards: B overrides A, B is disabled, and everyone keeps
    // calling B's closure — code belonging to an unloaded plugin.
    const reg = new ServiceRegistry();
    reg.provide("brew", { by: "A" }, "A");
    reg.provide("brew", { by: "B" }, "B");
    expect(reg.get<{ by: string }>("brew")?.by).toBe("B");

    reg.retractAll("B");
    expect(reg.get<{ by: string }>("brew")?.by).toBe("A");
  });

  it("lets a plugin replace its own earlier publication", () => {
    const reg = new ServiceRegistry();
    reg.provide("x", 1, "A");
    reg.provide("x", 2, "A");
    expect(reg.get("x")).toBe(2);
    reg.retractAll("A");
    expect(reg.has("x")).toBe(false);
  });
});
