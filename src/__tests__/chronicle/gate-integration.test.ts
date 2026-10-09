import { describe, it, expect, beforeEach } from "vitest";
import { container } from "../../Container.js";
import Chronicle from "../../content/Chronicle.js";
import WorldState from "../../world/chronicle/WorldState.js";
import EventCenter from "../../event/EventCenter.js";
import EventHistory from "../../event/EventHistory.js";
import LogStore from "../../core/store/LogStore.js";
import PluginHost from "../../core/plugin/PluginHost.js";
import DefaultEventAlgorithm from "../../event/DefaultEventAlgorithm.js";
import ChoiceEvent from "../../world/events/ChoiceEvent.js";
import Player from "../../world/Player.js";
import Effects from "../../content/Effects.js";

beforeEach(() => {
  Chronicle.load();
  Effects.load();
});

function buildGated(world: WorldState) {
  const eventCenter = new EventCenter();
  const eventHistory = new EventHistory();
  const logStore = new LogStore();
  const pluginHost = container.resolve(PluginHost);
  const incident = new ChoiceEvent({
    id: "gated_ev",
    nameKey: "gated_ev",
    rangeKey: ["10-90"],
    worldGate: { era: "era_iron" },
    choices: [{ id: "ok", labelKey: "ok", effects: { happiness: 1 } }],
  });
  eventCenter.add("10-90", incident);
  const algo = new DefaultEventAlgorithm({
    eventCenter,
    logStore,
    eventHistory,
    pluginHost,
    world,
  });
  return algo;
}

describe("world-gated events (engine integration)", () => {
  it("does not offer an event whose world gate is unmet", () => {
    const world = new WorldState();
    world.begin("reg_highland"); // era_dawn
    const algo = buildGated(world);
    const p = new Player({ age: 30 });
    algo.trigger(p);
    expect(algo.getPendingChoice()).toBeNull();
  });

  it("offers the event once the gate is satisfied", () => {
    const world = new WorldState();
    world.begin("reg_highland");
    world.tick(20, new Set()); // enters era_iron
    expect(world.eraId).toBe("era_iron");
    const algo = buildGated(world);
    const p = new Player({ age: 30 });
    algo.trigger(p);
    const pending = algo.getPendingChoice();
    expect(pending).not.toBeNull();
    expect(pending!.incidentId).toBe("gated_ev");
  });

  it("a faction gate opens after earning standing", () => {
    const world = new WorldState();
    world.begin("reg_highland"); // favours scholars (+10)
    const eventCenter = new EventCenter();
    const algo = new DefaultEventAlgorithm({
      eventCenter,
      logStore: new LogStore(),
      eventHistory: new EventHistory(),
      pluginHost: container.resolve(PluginHost),
      world,
    });
    eventCenter.add(
      "10-90",
      new ChoiceEvent({
        id: "scholar_ev",
        rangeKey: ["10-90"],
        worldGate: { faction: "fac_scholars", minStanding: 30 },
        choices: [{ id: "ok", labelKey: "ok" }],
      }),
    );
    const p = new Player({ age: 30 });
    algo.trigger(p);
    expect(algo.getPendingChoice()).toBeNull(); // only 10 standing
    world.adjustStanding("fac_scholars", 25); // now 35
    algo.trigger(p);
    expect(algo.getPendingChoice()?.incidentId).toBe("scholar_ev");
  });
});
