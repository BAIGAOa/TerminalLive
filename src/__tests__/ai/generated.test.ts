import { describe, it, expect } from "vitest";
import {
  GENERATED_ROLES,
  MAX_DESCRIPTION,
  STRANGER_AFFINITY,
  generatedNpcId,
  parseGeneratedNpc,
  toNpcDefinition,
} from "../../world/ai/generated.js";
import {
  MAX_EFFECT_PER_STAT,
  MAX_EFFECT_TOTAL,
  SAFE_EFFECT_KEYS,
  ageRange,
  clampEffects,
  parseGeneratedEvent,
  toEventDef,
} from "../../world/ai/generatedEvent.js";
import { plausibleRoles } from "../../world/ai/prompts.js";
import { ROLE_TO_TYPE } from "../../world/relationships/NpcRoles.js";
import { npcSchema } from "../../world/relationships/NpcDefinition.js";
import { modEventSchema } from "../../types/EventJsonType.js";

/** A model answer, as the model would write it. */
function answer(obj: unknown): string {
  return "Sure!\n```json\n" + JSON.stringify(obj) + "\n```";
}

const validNpc = {
  name: "Marta Reyes",
  roleKey: "npc.role.friend",
  description: "Runs the stall two doors down and knows everyone's business.",
  temperament: "warm, nosy, unbothered",
  traits: { warmth: 0.8, ambition: 0.2, stability: 0.7, sociability: 0.9 },
  opening: "You look like you've had a week. Sit down, I'll pour.",
};

describe("the roles worth meeting at each age", () => {
  it("only offers roles the game can actually simulate", () => {
    for (let age = 0; age <= 100; age++) {
      for (const role of plausibleRoles(age)) {
        expect(GENERATED_ROLES).toContain(role);
        expect(ROLE_TO_TYPE[role]).toBeDefined();
      }
    }
  });

  it("gives a toddler family and nothing else", () => {
    expect(plausibleRoles(2)).toEqual(["npc.role.family"]);
  });

  it("does not put a colleague in a child's life", () => {
    expect(plausibleRoles(10)).not.toContain("npc.role.work");
  });

  it("opens up work and partners in adulthood", () => {
    expect(plausibleRoles(30)).toContain("npc.role.work");
    expect(plausibleRoles(30)).toContain("npc.role.partner");
  });

  it("drops rivals and colleagues in old age", () => {
    expect(plausibleRoles(80)).not.toContain("npc.role.rival");
    expect(plausibleRoles(80)).not.toContain("npc.role.work");
  });

  it("always leaves something to meet", () => {
    for (let age = 0; age <= 120; age++) {
      expect(plausibleRoles(age).length).toBeGreaterThan(0);
    }
  });
});

describe("reading a character out of a model answer", () => {
  it("takes a well-formed answer", () => {
    const npc = parseGeneratedNpc(answer(validNpc));
    expect(npc?.name).toBe("Marta Reyes");
    expect(npc?.roleKey).toBe("npc.role.friend");
    expect(npc?.traits.warmth).toBe(0.8);
  });

  it("rejects a role the game does not simulate", () => {
    // Such an NPC would have no interactions and no autonomy — a name in a list
    // and nothing else.
    expect(parseGeneratedNpc(answer({ ...validNpc, roleKey: "npc.role.dragon" }))).toBeNull();
  });

  it("rejects a character with no name", () => {
    expect(parseGeneratedNpc(answer({ ...validNpc, name: "  " }))).toBeNull();
  });

  it("rejects an answer that is not JSON at all", () => {
    expect(parseGeneratedNpc("I would rather not.")).toBeNull();
  });

  it("bounds the text it accepts", () => {
    const npc = parseGeneratedNpc(
      answer({ ...validNpc, description: "x".repeat(MAX_DESCRIPTION + 200) }),
    );
    expect(npc?.description.length).toBe(MAX_DESCRIPTION);
  });

  it("brings a wild trait axis back into range", () => {
    const npc = parseGeneratedNpc(
      answer({ ...validNpc, traits: { ...validNpc.traits, warmth: 900 } }),
    );
    expect(npc?.traits.warmth).toBe(1);
  });

  it("falls back to a neutral profile when none is given", () => {
    const npc = parseGeneratedNpc(answer({ ...validNpc, traits: undefined }));
    expect(npc?.traits).toEqual({
      warmth: 0.3,
      ambition: 0.4,
      stability: 0.6,
      sociability: 0.5,
    });
  });
});

describe("turning a character into a definition", () => {
  const npc = parseGeneratedNpc(answer(validNpc))!;

  it("holds the model's text in the key fields, for the literal fallback", () => {
    const def = toNpcDefinition(npc, 30);
    expect(def.labelKey).toBe("Marta Reyes");
    expect(def.descKey).toBe(npc.description);
  });

  it("marks them as met, but not close", () => {
    const def = toNpcDefinition(npc, 30);
    expect(def.initial).toBe(STRANGER_AFFINITY);
    expect(def.knownFromAge).toBe(30);
  });

  it("carries the personality through params, where `Npc.traits()` reads it", () => {
    const def = toNpcDefinition(npc, 30);
    expect(def.params?.traits).toEqual(npc.traits);
  });

  it("gives the same character the same id twice", () => {
    expect(generatedNpcId(npc)).toBe(generatedNpcId(npc));
    expect(generatedNpcId(npc)).toMatch(/^ai_npc_/);
  });
});

describe("bounding what an invented event may do", () => {
  it("refuses to touch the stats that are not gauges", () => {
    // `age`, `height`, `weight` and `money` have no ceiling in `stats.ts`, so a
    // model free to move them is a model free to write an unbounded life.
    const delta = clampEffects({
      age: -40,
      height: 0.5,
      weight: 60,
      money: 100000,
      health: -4,
    });
    expect(delta).toEqual({ health: -4 });
  });

  it("caps any single stat", () => {
    expect(clampEffects({ happiness: 500 }).happiness).toBe(MAX_EFFECT_PER_STAT);
    expect(clampEffects({ happiness: -500 }).happiness).toBe(-MAX_EFFECT_PER_STAT);
  });

  it("scales an over-budget effect down instead of dropping parts of it", () => {
    const delta = clampEffects({ health: -10, happiness: -10, social: -10 });
    const total = Object.values(delta).reduce((s, v) => s + Math.abs(v ?? 0), 0);
    expect(total).toBeLessThanOrEqual(MAX_EFFECT_TOTAL);
    // Close to the budget, not far under it: the model's intent is scaled, not
    // thrown away.
    expect(total).toBeGreaterThan(MAX_EFFECT_TOTAL - 1);
    // The shape survives: all three are still there, in proportion.
    expect(Object.keys(delta).sort()).toEqual(["happiness", "health", "social"]);
  });

  it("drops values that are not numbers", () => {
    expect(clampEffects({ health: "lots" })).toEqual({});
  });

  it("only ever produces whitelisted keys", () => {
    expect(SAFE_EFFECT_KEYS).not.toContain("money");
    expect(SAFE_EFFECT_KEYS).not.toContain("age");
    expect(SAFE_EFFECT_KEYS).not.toContain("height");
    expect(SAFE_EFFECT_KEYS).not.toContain("weight");
  });
});

describe("reading an event out of a model answer", () => {
  const valid = {
    title: "The letter",
    body: "A letter arrives with no return address, in handwriting you recognise.",
    effects: { happiness: -4, depressionValue: 3 },
    weight: 0.3,
  };

  it("takes a well-formed answer", () => {
    const ev = parseGeneratedEvent(answer(valid));
    expect(ev?.title).toBe("The letter");
    expect(ev?.effects).toEqual({ happiness: -4, depressionValue: 3 });
  });

  it("rejects an event that does nothing", () => {
    expect(parseGeneratedEvent(answer({ ...valid, effects: {} }))).toBeNull();
    expect(parseGeneratedEvent(answer({ ...valid, effects: { money: 100 } }))).toBeNull();
  });

  it("rejects an event with nothing to say", () => {
    expect(parseGeneratedEvent(answer({ ...valid, body: "" }))).toBeNull();
  });

  it("keeps the weight inside the pool's range", () => {
    expect(parseGeneratedEvent(answer({ ...valid, weight: 99 }))?.weight).toBeLessThanOrEqual(0.6);
    expect(parseGeneratedEvent(answer({ ...valid, weight: 0 }))?.weight).toBeGreaterThan(0);
  });
});

describe("the age band an invented event may fire in", () => {
  it("is always well formed, because it is built rather than guessed", () => {
    // `modEventSchema` does not check the format, and `EventCenter.add` throws
    // on a bad one while `registerEvent` swallows the throw — so a malformed
    // range would produce an event that is registered and then never eligible.
    for (const age of [0, 5, 40, 98, 100, 150]) {
      const range = ageRange(age);
      expect(range).toMatch(/^\d+-\d+$/);
      const [start, end] = range.split("-").map(Number);
      expect(start).toBeLessThan(end);
      expect(end).toBeLessThanOrEqual(100);
    }
  });

  it("covers the age it was made for", () => {
    const [start, end] = ageRange(40).split("-").map(Number);
    expect(start).toBeLessThanOrEqual(40);
    expect(end).toBeGreaterThanOrEqual(40);
  });
});

describe("turning an event into a definition", () => {
  const ev = parseGeneratedEvent(
    answer({
      title: "The letter",
      body: "A letter arrives with no return address.",
      effects: { happiness: -4 },
      weight: 0.3,
    }),
  )!;

  it("produces something the loader's own schema accepts", () => {
    const def = toEventDef(ev, 30);
    expect(def).not.toBeNull();
    expect(def?.type).toBe("EffectEvent");
    expect(def?.id).toMatch(/^ai_ev_/);
    expect(def?.rangeKey).toEqual(["30-40"]);
    expect(def?.params?.effects).toEqual({ happiness: -4 });
  });

  it("pins the type and forbids choices", () => {
    // A generated `ChoiceEvent` would drag the modal and pending-choice save
    // machinery in with it; an EffectEvent applies a payload and needs no code.
    const def = toEventDef(ev, 30)!;
    expect(def.type).toBe("EffectEvent");
    expect(def.choices).toBeUndefined();
  });

  it("happens once, and in its own category", () => {
    const def = toEventDef(ev, 30)!;
    expect(def.once).toBe(true);
    expect(def.category).toBe("ai");
  });

  it("keeps the model's text in the key fields", () => {
    const def = toEventDef(ev, 30)!;
    expect(def.nameKey).toBe("The letter");
    expect(def.textKey).toContain("no return address");
  });
});

/**
 * The save stores these as whole definitions — the id alone would not survive,
 * because a load rebuilds the NPC registry from disk and re-derives traits from
 * the definition. So the definitions have to come back out of the save schemas
 * exactly as they went in.
 */
describe("what is invented survives the save schema", () => {
  it("round-trips an invented character", () => {
    const npc = parseGeneratedNpc(answer(validNpc))!;
    const def = toNpcDefinition(npc, 30);
    const parsed = npcSchema.parse(def as never);

    expect(parsed.id).toBe(def.id);
    expect(parsed.roleKey).toBe("npc.role.friend");
    expect(parsed.knownFromAge).toBe(30);
    expect(parsed.initial).toBe(STRANGER_AFFINITY);
    // The one that matters most: without it the character comes back with the
    // role's default personality and behaves like somebody else.
    expect(parsed.params?.traits).toEqual(npc.traits);
  });

  it("round-trips an invented event", () => {
    const ev = parseGeneratedEvent(
      answer({
        title: "The letter",
        body: "A letter arrives.",
        effects: { happiness: -4, health: -2 },
        weight: 0.3,
      }),
    )!;
    const def = toEventDef(ev, 30)!;
    const parsed = modEventSchema.parse(def);

    expect(parsed.id).toBe(def.id);
    expect(parsed.rangeKey).toEqual(["30-40"]);
    expect(parsed.params?.effects).toEqual({ happiness: -4, health: -2 });
    expect(parsed.once).toBe(true);
  });
});
