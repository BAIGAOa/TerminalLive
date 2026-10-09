import { describe, it, expect, beforeEach } from "vitest";
import { container } from "../../Container.js";
import EventCenter from "../../event/EventCenter.js";
import EventHistory from "../../event/EventHistory.js";
import LogStore from "../../core/store/LogStore.js";
import PluginHost from "../../core/plugin/PluginHost.js";
import DefaultEventAlgorithm from "../../event/DefaultEventAlgorithm.js";
import ChoiceEvent from "../../world/events/ChoiceEvent.js";
import Player from "../../world/Player.js";
import Effects from "../../content/Effects.js";
import { ChoiceDef } from "../../world/choices.js";

function build(choices: ChoiceDef[]) {
  const eventCenter = new EventCenter();
  const eventHistory = new EventHistory();
  const logStore = new LogStore();
  const pluginHost = container.resolve(PluginHost);
  const incident = new ChoiceEvent({
    id: "c1",
    nameKey: "c1",
    rangeKey: ["10-20"],
    choices,
  });
  eventCenter.add("10-20", incident);
  const algo = new DefaultEventAlgorithm({
    eventCenter,
    logStore,
    eventHistory,
    pluginHost,
  });
  return { algo, eventHistory };
}

describe("DefaultEventAlgorithm — choice events", () => {
  beforeEach(() => Effects.load());

  it("offers a pending choice instead of applying immediately", () => {
    const { algo, eventHistory } = build([
      { id: "a", labelKey: "a", effects: { happiness: 5 } },
      { id: "b", labelKey: "b", effects: { happiness: -5 } },
    ]);
    const p = new Player({ age: 15, happiness: 50 });
    algo.trigger(p);
    const pending = algo.getPendingChoice();
    expect(pending).not.toBeNull();
    expect(pending!.options.map((o) => o.def.id)).toEqual(["a", "b"]);
    expect(p.happiness).toBe(50); // nothing applied yet
    expect(eventHistory.isTriggered("c1")).toBe(false);
  });

  it("applies the chosen option and marks the event triggered", () => {
    const { algo, eventHistory } = build([
      { id: "a", labelKey: "a", effects: { happiness: 5 } },
      { id: "b", labelKey: "b", effects: { happiness: -5 } },
    ]);
    const p = new Player({ age: 15, happiness: 50 });
    algo.trigger(p);
    expect(algo.resolveChoice("a", p)).toBe(true);
    expect(p.happiness).toBe(55);
    expect(eventHistory.isTriggered("c1")).toBe(true);
    expect(algo.getPendingChoice()).toBeNull();
  });

  it("disables options whose requirement is unmet", () => {
    const { algo } = build([
      { id: "rich", labelKey: "rich", require: [{ prop: "money", gte: 1000 }] },
      { id: "poor", labelKey: "poor", effects: { happiness: 1 } },
    ]);
    const p = new Player({ age: 15, money: 0 });
    algo.trigger(p);
    const pending = algo.getPendingChoice()!;
    expect(pending.options.find((o) => o.def.id === "rich")!.disabled).toBe(true);
    expect(pending.options.find((o) => o.def.id === "poor")!.disabled).toBe(false);
    // resolving a disabled option is rejected
    expect(algo.resolveChoice("rich", p)).toBe(false);
  });

  it("commits without a choice when every option is gated out", () => {
    const { algo, eventHistory } = build([
      { id: "x", labelKey: "x", require: [{ prop: "money", gte: 9999 }] },
    ]);
    const p = new Player({ age: 15, money: 0 });
    algo.trigger(p);
    expect(algo.getPendingChoice()).toBeNull();
    expect(eventHistory.isTriggered("c1")).toBe(true);
  });

  it("blocks the next roll while a choice is pending", () => {
    const { algo } = build([{ id: "a", labelKey: "a" }]);
    const p = new Player({ age: 15 });
    algo.trigger(p);
    algo.trigger(p); // should not re-roll / overwrite
    expect(algo.getPendingChoice()).not.toBeNull();
  });
});
