import { describe, it, expect, vi, afterEach } from "vitest";
import { container } from "../../Container.js";
import EventCenter from "../../event/EventCenter.js";
import { WorldEventLoader } from "../../event/WorldEventLoader.js";
import EventTypeRegistry from "../../core/mod/EventTypeRegistry.js";
import EventTypes from "../../core/mod/EventTypes.js";
import {
  ageRange,
  parseGeneratedEvent,
  toEventDef,
} from "../../world/ai/generatedEvent.js";
import type { ModEventDef } from "../../types/EventJsonType.js";

/**
 * The half of the AI path that had no coverage: the model's answer already
 * parsed into a definition, and what happens to it after that.
 *
 * `generated.test.ts` stops at "produces something the loader's own schema
 * accepts". Everything downstream — the loader, the type registry, the pool —
 * is what actually decides whether an invented event can ever fire, and a
 * definition that dies quietly here is indistinguishable from a model that
 * never answered.
 */

// The loader consults the type registry the game fills at boot. Build the real
// one rather than a stand-in, so a definition the game could not load fails
// this test too.
EventTypes.registerAll();
const types = container.resolve(EventTypeRegistry);

/** The model's answer, in the shape the event prompt asks for. */
const REPLY = JSON.stringify({
  title: "A stranger's gift",
  body: "Someone left something at the door and was gone before you looked up.",
  effects: { happiness: 4 },
  weight: 0.4,
});

/** A pool with nothing in it, the way a freshly entered world starts out. */
function emptyPool() {
  const center = new EventCenter();
  return { center, loader: new WorldEventLoader(center, types) };
}

/** The whole path an invented event takes: model text → definition → pool. */
function inject(age: number, reply = REPLY) {
  const drafted = parseGeneratedEvent(reply);
  const def = drafted ? toEventDef(drafted, age) : null;
  const pool = emptyPool();
  if (def) pool.loader.registerEvent(def);
  return { drafted, def, ...pool };
}

/** Keep an expected warning out of the run's output. */
function silence(method: "warn" | "error") {
  return vi.spyOn(console, method).mockImplementation(() => {});
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("an invented event reaching the world's pool", () => {
  it("ends up registered under its own id", () => {
    const { def, center } = inject(20);
    expect(def).not.toBeNull();
    expect(center.getIncidentById(def!.id)).toBeDefined();
  });

  it("lands in the age band it was made for", () => {
    const { def, center } = inject(20);
    const band = def!.rangeKey[0];
    expect(band).toBe(ageRange(20));
    const inBand = [...(center.getIncidentsByRange(band) ?? [])].map((i) => i.id);
    expect(inBand).toContain(def!.id);
  });

  it("carries the model's own words through to the incident", () => {
    const { def, center } = inject(20);
    const incident = center.getIncidentById(def!.id)!;
    expect(incident.nameKey).toBe("A stranger's gift");
    expect(incident.textKey).toBe(
      "Someone left something at the door and was gone before you looked up.",
    );
  });

  it("is the only thing in the pool", () => {
    const { center } = inject(20);
    expect(center.getAllIncidentIds()).toHaveLength(1);
    expect(center.getAllRanges()).toEqual([ageRange(20)]);
  });

  it("does not disturb an event invented in another band", () => {
    const young = toEventDef(parseGeneratedEvent(REPLY)!, 12)!;
    const old = toEventDef(
      parseGeneratedEvent(JSON.stringify({ ...JSON.parse(REPLY), title: "A later gift" }))!,
      70,
    )!;
    const { center, loader } = emptyPool();
    loader.registerEvent(young);
    loader.registerEvent(old);

    expect(center.getIncidentById(young.id)).toBeDefined();
    expect(center.getIncidentById(old.id)).toBeDefined();
    expect(ageRange(12)).not.toBe(ageRange(70));
  });
});

describe("what the pool refuses", () => {
  it("an answer that does nothing is not an event", () => {
    const reply = JSON.stringify({
      title: "Nothing",
      body: "Nothing happened.",
      effects: {},
    });
    expect(parseGeneratedEvent(reply)).toBeNull();

    const { center } = inject(20, reply);
    expect(center.getAllIncidentIds()).toEqual([]);
  });

  it("an event of a type the game does not simulate is skipped, not thrown", () => {
    const warn = silence("warn");
    const def = toEventDef(parseGeneratedEvent(REPLY)!, 20)!;
    const alien = { ...def, type: "NotARealEvent" } as ModEventDef;

    const { center, loader } = emptyPool();
    expect(() => loader.registerEvent(alien)).not.toThrow();
    expect(center.getAllIncidentIds()).toEqual([]);
    expect(center.getAllRanges()).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("registering the same definition twice leaves the pool intact", () => {
    // `registerEvent` builds a *new* incident on every call, and `EventCenter`
    // rejects a second instance under an id it already holds — which is exactly
    // why `GenesisService.registerEventsInto` checks `getIncidentById` first.
    const error = silence("error");
    const { def, center, loader } = inject(20);

    expect(() => loader.registerEvent(def!)).not.toThrow();

    expect(center.getAllIncidentIds()).toEqual([def!.id]);
    expect(center.getIncidentsByRange(def!.rangeKey[0])!.size).toBe(1);
    expect(error).toHaveBeenCalled();
  });
});
