import { EraDefinition } from "./eras.js";
import { FactionDefinition } from "./factions.js";
import { RegionDefinition } from "./regions.js";
import { LoreDefinition } from "./lore.js";
import { FateArcDefinition } from "./fate.js";
import { WorldEventDefinition } from "./worldEvents.js";

/** A serialisable snapshot of the whole chronicle content set. */
export interface ChronicleSnapshot {
  eras: EraDefinition[];
  factions: Array<[string, FactionDefinition]>;
  regions: Array<[string, RegionDefinition]>;
  lore: LoreDefinition[];
  fates: FateArcDefinition[];
  worldEvents: Array<[string, WorldEventDefinition]>;
}

/** Holds every definition of the chronicle (eras, factions, regions, lore, fate). */
export default class ChronicleRegistry {
  private eras: EraDefinition[] = [];
  private factions = new Map<string, FactionDefinition>();
  private regions = new Map<string, RegionDefinition>();
  private lore: LoreDefinition[] = [];
  private fates: FateArcDefinition[] = [];
  private worldEvents = new Map<string, WorldEventDefinition>();

  public registerEra(def: EraDefinition): void {
    this.eras.push(def);
  }
  public registerFaction(def: FactionDefinition): void {
    this.factions.set(def.id, def);
  }
  public registerRegion(def: RegionDefinition): void {
    this.regions.set(def.id, def);
  }
  public registerLore(def: LoreDefinition): void {
    if (this.lore.some((l) => l.id === def.id)) {
      throw new Error(`典籍 ID 重复: ${def.id}`);
    }
    this.lore.push(def);
  }
  public registerFate(def: FateArcDefinition): void {
    if (this.fates.some((f) => f.id === def.id)) {
      throw new Error(`命运 ID 重复: ${def.id}`);
    }
    this.fates.push(def);
  }

  public getEras(): EraDefinition[] {
    return this.eras;
  }
  public getFactions(): FactionDefinition[] {
    return [...this.factions.values()];
  }
  public getFaction(id: string): FactionDefinition | undefined {
    return this.factions.get(id);
  }
  public getRegions(): RegionDefinition[] {
    return [...this.regions.values()];
  }
  public getRegion(id: string): RegionDefinition | undefined {
    return this.regions.get(id);
  }
  public getLore(): LoreDefinition[] {
    return this.lore;
  }
  public getFates(): FateArcDefinition[] {
    return this.fates;
  }
  public registerWorldEvent(def: WorldEventDefinition): void {
    if (this.worldEvents.has(def.id)) {
      throw new Error(`世界事件 ID 重复: ${def.id}`);
    }
    this.worldEvents.set(def.id, def);
  }
  public getWorldEvents(): WorldEventDefinition[] {
    return [...this.worldEvents.values()];
  }
  public getWorldEvent(id: string): WorldEventDefinition | undefined {
    return this.worldEvents.get(id);
  }

  // ── resettable (World content layering) ────────────────────────
  public snapshot(): ChronicleSnapshot {
    return {
      eras: [...this.eras],
      factions: [...this.factions.entries()],
      regions: [...this.regions.entries()],
      lore: [...this.lore],
      fates: [...this.fates],
      worldEvents: [...this.worldEvents.entries()],
    };
  }

  public restore(snap: ChronicleSnapshot): void {
    this.eras = [...snap.eras];
    this.factions = new Map(snap.factions);
    this.regions = new Map(snap.regions);
    this.lore = [...snap.lore];
    this.fates = [...snap.fates];
    this.worldEvents = new Map(snap.worldEvents);
  }

  public clear(): void {
    this.eras = [];
    this.factions = new Map();
    this.regions = new Map();
    this.lore = [];
    this.fates = [];
    this.worldEvents = new Map();
  }
}
