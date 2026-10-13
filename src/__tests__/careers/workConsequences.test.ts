import { describe, it, expect } from "vitest";
import {
  SAFE_PERFORMANCE,
  STRIKE_PERFORMANCE,
  STRIKES_TO_FIRE,
  emptyWorkState,
  tickWork,
  type WorkState,
  type WorkStats,
} from "../../world/careers/careerEngine.js";

/** Someone with nothing else going for them. */
function stats(over: Partial<WorkStats> = {}): WorkStats {
  return {
    intelligence: 50,
    social: 50,
    fitness: 50,
    health: 80,
    happiness: 60,
    age: 35,
    ...over,
  };
}

/** A dice that always rolls the middle, so the noise term drops out. */
const neutral = () => 0.5;

function work(over: Partial<WorkState> = {}): WorkState {
  return { ...emptyWorkState(), ...over };
}

describe("the body and the mind show up at work", () => {
  it("leaves a healthy worker ahead of an unwell one", () => {
    // `WorkStats` declared health, happiness, intelligence and social from the
    // start and `tickWork` read none of them, so a career was indifferent to
    // the body and mind it was being spent on.
    const well = work();
    const ill = work();
    for (let i = 0; i < 10; i++) {
      tickWork(well, stats({ health: 95, happiness: 90 }), neutral);
      tickWork(ill, stats({ health: 25, happiness: 25 }), neutral);
    }
    expect(well.performance).toBeGreaterThan(ill.performance);
  });

  it("burns out faster on a poor body", () => {
    const sick = work();
    const fit = work();
    tickWork(sick, stats({ fitness: 20, health: 30 }), neutral);
    tickWork(fit, stats({ fitness: 80, health: 90 }), neutral);
    expect(sick.burnout).toBeGreaterThan(fit.burnout);
  });

  it("lets a steady worker recover instead of drifting into collapse", () => {
    // Burnout used to be a flat +3 with only fitness against it and no recovery
    // at all, so every worker alive hit 100 eventually — invisible until
    // dismissal existed, at which point the whole population started losing
    // jobs. A fit worker having a good life must be able to come back down.
    const w = work({ burnout: 60, performance: 70 });
    for (let i = 0; i < 5; i++) {
      tickWork(w, stats({ fitness: 70, health: 90, happiness: 80 }), neutral);
    }
    expect(w.burnout).toBeLessThan(60);
  });
});

describe("strikes and the door", () => {
  /** Forces a year bad enough to be a strike. */
  const badYear = (w: WorkState) => {
    w.performance = 5;
    return tickWork(w, stats({ health: 20, happiness: 20 }), neutral);
  };

  it("counts a bad year against you", () => {
    const w = work();
    const events = badYear(w);
    expect(w.strikes).toBe(1);
    expect(events.map((e) => e.kind)).toContain("work.warned");
  });

  it("clears the slate after a good year", () => {
    const w = work({ strikes: 2, performance: 90 });
    tickWork(w, stats({ health: 95, happiness: 90 }), neutral);
    expect(w.strikes).toBe(0);
  });

  it("clears the slate on any year that is not a strike", () => {
    // "Three in a row" has to mean *in a row*. An earlier version only cleared
    // at a comfortable 55, so a career oscillating between bad and mediocre
    // accumulated strikes across years that were, on average, fine.
    const w = work({ strikes: 2, performance: 45 });
    tickWork(w, stats(), neutral);
    expect(w.strikes).toBe(0);
  });

  it("shows you the door after three in a row", () => {
    const w = work();
    for (let i = 0; i < STRIKES_TO_FIRE; i++) {
      const events = badYear(w);
      const last = i === STRIKES_TO_FIRE - 1;
      if (last) {
        expect(events.map((e) => e.kind)).toContain("work.fired");
      }
    }
    expect(w.strikes).toBeGreaterThanOrEqual(STRIKES_TO_FIRE);
  });

  it("keeps the lines in a sensible order", () => {
    expect(STRIKE_PERFORMANCE).toBeLessThan(SAFE_PERFORMANCE);
  });

  it("treats a missing strikes counter as zero", () => {
    // Old saves parse with `strikes: 0`, but the engine is also driven by
    // hand-built states in tests and by mods.
    const w = work();
    delete (w as { strikes?: number }).strikes;
    expect(() => badYear(w)).not.toThrow();
    expect(w.strikes).toBe(1);
  });
});
