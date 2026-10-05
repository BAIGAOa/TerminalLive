import { container } from "../../Container.js";
import ChronicleRegistry from "./ChronicleRegistry.js";
import { eraForYear } from "./eras.js";
import { applyKarma, emptyKarma, KarmaDelta, KarmaState } from "./karma.js";
import { unlockedLore } from "./lore.js";
import { evaluateFates, fateWeightFactor } from "./fate.js";
import { ChronicleContext } from "./unlock.js";
import type { Climate } from "../weather/WeatherDefinition.js";
import RandomService from "../../core/random/RandomService.js";

export interface WorldTickResult {
  /** Era id entered this tick, if the world crossed an era boundary. */
  eraChanged?: string;
  /** Lore ids unlocked this tick. */
  newLore: string[];
  /** Fate arc ids awakened this tick. */
  newFates: string[];
  /** World-event ids whose year arrived this tick. */
  worldEvents: string[];
}

/** A tolerant shape accepted by {@link WorldState.restore} (e.g. from a save). */
export interface WorldSnapshotInput {
  year: number;
  eraId: string;
  regionId: string;
  karma: Partial<KarmaState>;
  standing: Record<string, number>;
  unlockedLore: string[];
  activeFates: string[];
  firedWorldEvents?: string[];
}

export interface WorldSnapshot extends WorldSnapshotInput {
  karma: KarmaState;
  firedWorldEvents: string[];
}

const STANDING_MIN = -100;
const STANDING_MAX = 100;

/**
 * The living world a life unfolds in: it advances year by year, unlocks lore,
 * awakens fate arcs, and tracks the player's karma and faction standing.
 *
 * A container singleton, reset for each new life via {@link begin}.
 */
export default class WorldState {
  private registry: ChronicleRegistry;
  private random: RandomService;

  public year = 0;
  public eraId = "";
  public regionId = "";
  public karma: KarmaState = emptyKarma();
  public standing = new Map<string, number>();
  public unlockedLore = new Set<string>();
  public activeFates = new Set<string>();
  /** World-event ids already fired this life. */
  public firedWorldEvents = new Set<string>();
  /** Latest player flags, supplied each tick (kept by reference). */
  private flags: Set<string> = new Set();

  private listeners = new Set<() => void>();
  private version = 0;

  constructor() {
    this.registry = container.resolve(ChronicleRegistry);
    this.random = container.resolve(RandomService);
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getSnapshot = (): number => this.version;

  private notify(): void {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  /** Reset the world for a new life; `regionId` picks a region (else random). */
  public begin(regionId?: string): void {
    const regions = this.registry.getRegions();
    const region =
      (regionId && this.registry.getRegion(regionId)) ||
      regions[this.random.int(regions.length)];

    this.year = 0;
    this.regionId = region?.id ?? "";
    this.karma = emptyKarma();
    this.standing = new Map();
    this.unlockedLore = new Set();
    this.activeFates = new Set();
    this.firedWorldEvents = new Set();
    this.flags = new Set();
    this.eraId = eraForYear(this.registry.getEras(), 0)?.id ?? "";

    if (region) {
      this.karma = applyKarma(this.karma, region.startKarma ?? {});
      if (region.favorFaction) this.standing.set(region.favorFaction, 10);
    }
    this.refreshUnlocks();
    this.notify();
  }

  public context(): ChronicleContext {
    return {
      year: this.year,
      eraId: this.eraId,
      karma: this.karma,
      standing: this.standing,
      flags: this.flags,
    };
  }

  public applyKarma(delta: KarmaDelta): void {
    this.karma = applyKarma(this.karma, delta);
    this.refreshUnlocks();
    this.notify();
  }

  public adjustStanding(faction: string, delta: number): void {
    this.applyStanding(faction, delta);
    // Rivalry dynamics: helping one faction sours its rivals.
    const rivals = new Set(this.registry.getFaction(faction)?.rivals ?? []);
    for (const f of this.registry.getFactions()) {
      if (f.rivals?.includes(faction)) rivals.add(f.id);
    }
    for (const rival of rivals) this.applyStanding(rival, -delta * 0.3);
    this.refreshUnlocks();
    this.notify();
  }

  private applyStanding(faction: string, delta: number): void {
    const next = Math.max(
      STANDING_MIN,
      Math.min(STANDING_MAX, (this.standing.get(faction) ?? 0) + delta),
    );
    this.standing = new Map(this.standing).set(faction, next);
  }

  /** Force-unlock a lore entry (used by world events). */
  public unlockLore(id: string): boolean {
    if (this.unlockedLore.has(id)) return false;
    this.unlockedLore.add(id);
    this.notify();
    return true;
  }

  /** Advance the world to `year`, returning what changed. */
  public tick(year: number, flags: Set<string>): WorldTickResult {
    this.flags = flags;
    this.year = year;

    const era = eraForYear(this.registry.getEras(), year);
    let eraChanged: string | undefined;
    if (era && era.id !== this.eraId) {
      this.eraId = era.id;
      eraChanged = era.id;
    }

    // Fire any world events whose year has arrived.
    const worldEvents: string[] = [];
    for (const ev of this.registry.getWorldEvents()) {
      if (ev.year <= year && !this.firedWorldEvents.has(ev.id)) {
        this.firedWorldEvents.add(ev.id);
        worldEvents.push(ev.id);
      }
    }

    const result = this.refreshUnlocks();
    this.notify();
    return {
      eraChanged,
      newLore: result.newLore,
      newFates: result.newFates,
      worldEvents,
    };
  }

  /** Compute newly unlocked lore/fates and record them. */
  private refreshUnlocks(): { newLore: string[]; newFates: string[] } {
    const ctx = this.context();
    const newLore: string[] = [];
    for (const id of unlockedLore(this.registry.getLore(), ctx)) {
      if (!this.unlockedLore.has(id)) {
        this.unlockedLore.add(id);
        newLore.push(id);
      }
    }
    const newFates: string[] = [];
    for (const id of evaluateFates(this.registry.getFates(), ctx)) {
      if (!this.activeFates.has(id)) {
        this.activeFates.add(id);
        newFates.push(id);
      }
    }
    return { newLore, newFates };
  }

  public toSnapshot(): WorldSnapshot {
    return {
      year: this.year,
      eraId: this.eraId,
      regionId: this.regionId,
      karma: { ...this.karma },
      standing: Object.fromEntries(this.standing),
      unlockedLore: [...this.unlockedLore],
      activeFates: [...this.activeFates],
      firedWorldEvents: [...this.firedWorldEvents],
    };
  }

  public restore(snap: WorldSnapshotInput, flags: Set<string> = new Set()): void {
    this.year = snap.year;
    this.eraId = snap.eraId;
    this.regionId = snap.regionId;
    this.karma = { ...emptyKarma(), ...snap.karma };
    this.standing = new Map(Object.entries(snap.standing));
    this.unlockedLore = new Set(snap.unlockedLore);
    this.activeFates = new Set(snap.activeFates);
    this.firedWorldEvents = new Set(snap.firedWorldEvents ?? []);
    this.flags = flags;
    this.notify();
  }

  /** Weight multiplier an event id gets from all active fate arcs. */
  public fateWeight(eventId: string): number {
    return fateWeightFactor(this.registry.getFates(), this.activeFates, eventId);
  }

  /** The climate band of the player's home region (defaults to temperate). */
  public climate(): Climate {
    return this.registry.getRegion(this.regionId)?.climate ?? "temperate";
  }
}
