import { EraDefinition } from "./eras.js";
import { FactionDefinition } from "./factions.js";
import { RegionDefinition } from "./regions.js";
import { LoreDefinition } from "./lore.js";
import { FateArcDefinition } from "./fate.js";
import { WorldEventDefinition } from "./worldEvents.js";

/** Holds every definition of the chronicle (eras, factions, regions, lore, fate). */
export default class WorldRegistry {
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
}
