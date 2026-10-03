import { container } from "../Container.js";
import WorldRegistry from "../world/chronicle/WorldRegistry.js";
import { EraDefinition } from "../world/chronicle/eras.js";
import { FactionDefinition } from "../world/chronicle/factions.js";
import { RegionDefinition } from "../world/chronicle/regions.js";
import { LoreDefinition } from "../world/chronicle/lore.js";
import { FateArcDefinition } from "../world/chronicle/fate.js";
import { WorldEventDefinition } from "../world/chronicle/worldEvents.js";

/** The world's history, passed one era at a time across a life. */
const ERAS: EraDefinition[] = [
  { id: "era_dawn", labelKey: "era.dawn", descKey: "era.dawn.desc", fromYear: 0, icon: "🌅", color: "yellow" },
  { id: "era_iron", labelKey: "era.iron", descKey: "era.iron.desc", fromYear: 20, icon: "⚒", color: "gray" },
  { id: "era_steam", labelKey: "era.steam", descKey: "era.steam.desc", fromYear: 40, icon: "⚙", color: "white" },
  { id: "era_electric", labelKey: "era.electric", descKey: "era.electric.desc", fromYear: 60, icon: "⚡", color: "cyan" },
  { id: "era_star", labelKey: "era.star", descKey: "era.star.desc", fromYear: 85, icon: "✦", color: "magentaBright" },
];

/** The four powers whose favour a life can win. */
const FACTIONS: FactionDefinition[] = [
  { id: "fac_scholars", labelKey: "faction.scholars", descKey: "faction.scholars.desc", icon: "📜" },
  { id: "fac_merchants", labelKey: "faction.merchants", descKey: "faction.merchants.desc", icon: "⚖" },
  { id: "fac_wardens", labelKey: "faction.wardens", descKey: "faction.wardens.desc", icon: "🛡", rivals: ["fac_shadows"] },
  { id: "fac_shadows", labelKey: "faction.shadows", descKey: "faction.shadows.desc", icon: "🗝", rivals: ["fac_wardens"] },
];

/** Birthplaces, each colouring a life with a starting tone. */
const REGIONS: RegionDefinition[] = [
  { id: "reg_heartland", labelKey: "region.heartland", descKey: "region.heartland.desc", icon: "🌾", favorFaction: "fac_merchants", startKarma: { ambition: 5 }, climate: "temperate", neighbors: ["reg_harbor", "reg_highland"] },
  { id: "reg_highland", labelKey: "region.highland", descKey: "region.highland.desc", icon: "⛰", favorFaction: "fac_scholars", startKarma: { wisdom: 5 }, climate: "highland", neighbors: ["reg_heartland", "reg_wastes"] },
  { id: "reg_harbor", labelKey: "region.harbor", descKey: "region.harbor.desc", icon: "⚓", favorFaction: "fac_wardens", startKarma: { benevolence: 5 }, climate: "coastal", neighbors: ["reg_heartland", "reg_wastes"] },
  { id: "reg_wastes", labelKey: "region.wastes", descKey: "region.wastes.desc", icon: "🌪", favorFaction: "fac_shadows", startKarma: { rebellion: 5 }, climate: "arid", neighbors: ["reg_highland", "reg_harbor"] },
];

/** Scripted events in the world's own chronology. */
const WORLD_EVENTS: WorldEventDefinition[] = [
  { id: "we_hard_winter", year: 6, labelKey: "worldev.hard_winter", bodyKey: "worldev.hard_winter.body", pressures: { pr_temp: -8, pr_harvest: -6 } },
  { id: "we_famine", year: 22, labelKey: "worldev.famine", bodyKey: "worldev.famine.body", pressures: { pr_harvest: -15, pr_scarcity: 15, pr_unrest: 8 } },
  { id: "we_plague", year: 32, labelKey: "worldev.plague", bodyKey: "worldev.plague.body", pressures: { pr_plague: 22, pr_despair: 10, pr_vitality: -10 } },
  { id: "we_war", year: 44, labelKey: "worldev.war", bodyKey: "worldev.war.body", pressures: { pr_tension: 22, pr_order: -10, pr_unrest: 8 }, standing: { faction: "fac_wardens", delta: 10 }, flag: "wartime" },
  { id: "we_golden_age", year: 54, labelKey: "worldev.golden_age", bodyKey: "worldev.golden_age.body", pressures: { pr_prosperity: 20, pr_morale: 14, pr_arts: 14 } },
  { id: "we_renaissance", year: 64, labelKey: "worldev.renaissance", bodyKey: "worldev.renaissance.body", pressures: { pr_innovation: 20, pr_literacy: 16, pr_curiosity: 10 } },
  { id: "we_starfall", year: 88, labelKey: "worldev.starfall", bodyKey: "worldev.starfall.body", pressures: { pr_mystery: 24, pr_otherworld: 20 }, karma: { wisdom: 6 } },
];

/** Codex entries unlocked as the world (and the player) changes. */
const LORE: LoreDefinition[] = [
  { id: "lore_first_light", titleKey: "lore.first_light", bodyKey: "lore.first_light.body", category: "era", unlock: { kind: "year", year: 1 } },
  { id: "lore_iron_pact", titleKey: "lore.iron_pact", bodyKey: "lore.iron_pact.body", category: "era", unlock: { kind: "era", era: "era_iron" } },
  { id: "lore_steam_rise", titleKey: "lore.steam_rise", bodyKey: "lore.steam_rise.body", category: "era", unlock: { kind: "era", era: "era_steam" } },
  { id: "lore_electric_age", titleKey: "lore.electric_age", bodyKey: "lore.electric_age.body", category: "era", unlock: { kind: "era", era: "era_electric" } },
  { id: "lore_star_gate", titleKey: "lore.star_gate", bodyKey: "lore.star_gate.body", category: "era", unlock: { kind: "era", era: "era_star" } },

  { id: "lore_scholars_secret", titleKey: "lore.scholars_secret", bodyKey: "lore.scholars_secret.body", category: "faction", unlock: { kind: "faction", faction: "fac_scholars", min: 30 } },
  { id: "lore_merchant_ledger", titleKey: "lore.merchant_ledger", bodyKey: "lore.merchant_ledger.body", category: "faction", unlock: { kind: "faction", faction: "fac_merchants", min: 30 } },
  { id: "lore_wardens_oath", titleKey: "lore.wardens_oath", bodyKey: "lore.wardens_oath.body", category: "faction", unlock: { kind: "faction", faction: "fac_wardens", min: 30 } },
  { id: "lore_shadows_whisper", titleKey: "lore.shadows_whisper", bodyKey: "lore.shadows_whisper.body", category: "faction", unlock: { kind: "faction", faction: "fac_shadows", min: 30 } },

  { id: "lore_kind_heart", titleKey: "lore.kind_heart", bodyKey: "lore.kind_heart.body", category: "karma", unlock: { kind: "karma", axis: "benevolence", gte: 30 } },
  { id: "lore_dark_whisper", titleKey: "lore.dark_whisper", bodyKey: "lore.dark_whisper.body", category: "karma", unlock: { kind: "karma", axis: "rebellion", gte: 30 } },
  { id: "lore_wise_one", titleKey: "lore.wise_one", bodyKey: "lore.wise_one.body", category: "karma", unlock: { kind: "karma", axis: "wisdom", gte: 40 } },
  { id: "lore_iron_will", titleKey: "lore.iron_will", bodyKey: "lore.iron_will.body", category: "karma", unlock: { kind: "karma", axis: "ambition", gte: 40 } },

  { id: "lore_traveler", titleKey: "lore.traveler", bodyKey: "lore.traveler.body", category: "deed", unlock: { kind: "flag", flag: "traveled" } },
  { id: "lore_grand_design", titleKey: "lore.grand_design", bodyKey: "lore.grand_design.body", category: "secret", unlock: { kind: "all", of: [{ kind: "era", era: "era_star" }, { kind: "karma", axis: "wisdom", gte: 30 }] } },
  { id: "lore_crowned_rebel", titleKey: "lore.crowned_rebel", bodyKey: "lore.crowned_rebel.body", category: "secret", unlock: { kind: "all", of: [{ kind: "karma", axis: "rebellion", gte: 50 }, { kind: "faction", faction: "fac_shadows", min: 40 }] } },
];

/** Destinies that awaken and bias the life's events. */
const FATES: FateArcDefinition[] = [
  { id: "fate_sage", labelKey: "fate.sage", descKey: "fate.sage.desc", icon: "🦉", unlock: { kind: "karma", axis: "wisdom", gte: 40 }, favorEvents: ["ev_math_olympiad", "ev_school_contest", "ev_exam_cram"], factor: 2, buff: { id: "fx_wisdom", turns: 5 } },
  { id: "fate_tycoon", labelKey: "fate.tycoon", descKey: "fate.tycoon.desc", icon: "💰", unlock: { kind: "karma", axis: "ambition", gte: 40 }, favorEvents: ["ev_invest", "ev_interview", "ev_side_hustle"], factor: 2, buff: { id: "fx_fortune", turns: 5 } },
  { id: "fate_guardian", labelKey: "fate.guardian", descKey: "fate.guardian.desc", icon: "🛡", unlock: { kind: "karma", axis: "benevolence", gte: 40 }, favorEvents: ["ev_public_good", "ev_help_old", "ev_charity"], factor: 2, buff: { id: "fx_blessed", turns: 5 } },
  { id: "fate_rebel", labelKey: "fate.rebel", descKey: "fate.rebel.desc", icon: "🔥", unlock: { kind: "karma", axis: "rebellion", gte: 40 }, favorEvents: ["ev_peer_pressure", "ev_rumor", "ev_online_fame"], factor: 2, buff: { id: "fx_charm", turns: 4 } },
  { id: "fate_scholar_path", labelKey: "fate.scholar_path", descKey: "fate.scholar_path.desc", icon: "📚", unlock: { kind: "faction", faction: "fac_scholars", min: 40 }, favorEvents: ["ev_school_contest", "ev_interview"], factor: 2 },
  { id: "fate_star_child", labelKey: "fate.star_child", descKey: "fate.star_child.desc", icon: "✦", unlock: { kind: "all", of: [{ kind: "era", era: "era_star" }, { kind: "year", year: 85 }] }, buff: { id: "fx_blessed", turns: 6 } },
];

export default class World {
  private static init = false;

  public static load(): void {
    if (this.init) return;
    this.init = true;
    const reg = container.resolve(WorldRegistry);
    for (const e of ERAS) reg.registerEra(e);
    for (const f of FACTIONS) reg.registerFaction(f);
    for (const r of REGIONS) reg.registerRegion(r);
    for (const l of LORE) reg.registerLore(l);
    for (const f of FATES) reg.registerFate(f);
    for (const we of WORLD_EVENTS) reg.registerWorldEvent(we);
  }
}
