import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { inject } from "../Container.js";
import {
  clearWorldTranslations,
  setWorldTranslations,
} from "../core/language/WorldTranslations.js";
import type World from "./World.js";
import ChronicleRegistry, {
  type ChronicleSnapshot,
} from "../world/chronicle/ChronicleRegistry.js";
import WeatherRegistry, {
  type WeatherSnapshot,
} from "../world/weather/WeatherRegistry.js";
import PressureRegistry, {
  type PressureSnapshot,
} from "../world/pressures/PressureRegistry.js";
import NpcRegistry from "../world/relationships/NpcRegistry.js";
import type { Npc } from "../world/relationships/Npc.js";
import ChronicleLoader from "../world/chronicle/ChronicleLoader.js";
import WeatherLoader from "../world/weather/WeatherLoader.js";
import PressureLoader from "../world/pressures/PressureLoader.js";
import NpcLoader from "../world/relationships/NpcLoader.js";
import WorldRuleLoader from "../world/rules/WorldRuleLoader.js";
import BuiltinPluginRegistry from "../core/mod/BuiltinPlugin.js";
import ModPluginLoader from "../core/mod/ModPluginLoader.js";

/** The built-in + mod content that every world layers on top of. */
interface WorldContentBase {
  chronicle: ChronicleSnapshot;
  weather: WeatherSnapshot;
  pressures: PressureSnapshot;
  npcs: Array<[string, Npc]>;
}

/**
 * Installs a World's own content into the (single, reused) content registries
 * at life-start: it first restores the captured built-in + mod baseline, then
 * layers the world's `chronicle/`, `weather/`, `pressures/` and `npcs/` dirs.
 *
 * Only one world is ever active, so resetting the singletons in place is safe.
 * The world's `npcs/` dir *replaces* the shared cast (mod cast re-applied);
 * the other categories layer over the baseline unless `selfContained` is set.
 */
export default class WorldContentLoader {
  private chronicle: ChronicleRegistry;
  private weather: WeatherRegistry;
  private pressures: PressureRegistry;
  private npcs: NpcRegistry;
  private chronicleLoader: ChronicleLoader;
  private weatherLoader: WeatherLoader;
  private pressureLoader: PressureLoader;
  private builtins: BuiltinPluginRegistry;
  private npcLoader: NpcLoader;
  private ruleLoader: WorldRuleLoader;
  private mods: ModPluginLoader;

  private base: WorldContentBase | null = null;

  constructor() {
    this.chronicle = inject(ChronicleRegistry);
    this.weather = inject(WeatherRegistry);
    this.pressures = inject(PressureRegistry);
    this.npcs = inject(NpcRegistry);
    this.chronicleLoader = inject(ChronicleLoader);
    this.weatherLoader = inject(WeatherLoader);
    this.pressureLoader = inject(PressureLoader);
    this.npcLoader = inject(NpcLoader);
    this.ruleLoader = inject(WorldRuleLoader);
    this.builtins = inject(BuiltinPluginRegistry);
    this.mods = inject(ModPluginLoader);
  }

  /**
   * Capture the built-in + mod baseline. Call once at boot, after all global
   * content (built-in + mods) is loaded.
   */
  public captureBase(): void {
    this.base = {
      chronicle: this.chronicle.snapshot(),
      weather: this.weather.snapshot(),
      pressures: this.pressures.snapshot(),
      npcs: this.npcs.snapshot(),
    };
  }

  /** Install `world`'s content. Must run before the subsystem resets. */
  public loadFor(world: World): void {
    if (!this.base) this.captureBase();
    const base = this.base!;

    this.chronicle.restore(base.chronicle);
    this.weather.restore(base.weather);
    this.pressures.restore(base.pressures);
    this.npcs.restore(base.npcs);

    const dir = world.contentDir;
    const replace = world.selfContained;
    const cleared = { chronicle: false, pressures: false };

    const chronicleDir = join(dir, "chronicle");
    if (existsSync(chronicleDir)) {
      if (replace) {
        this.chronicle.clear();
        cleared.chronicle = true;
      }
      this.chronicleLoader.loadDir(chronicleDir);
    }

    const weatherDir = join(dir, "weather");
    if (existsSync(weatherDir)) {
      if (replace) this.weather.clear();
      this.weatherLoader.loadDir(weatherDir);
    }

    const pressureDir = join(dir, "pressures");
    if (existsSync(pressureDir)) {
      if (replace) {
        this.pressures.clear();
        cleared.pressures = true;
      }
      this.pressureLoader.loadDir(pressureDir);
    }

    // Built-in plugins may add hidden-score axes + coupling rules to this world.
    for (const ax of this.builtins.pressureAxesFor(world.id)) {
      if (!this.pressures.hasAxis(ax.id)) this.pressures.registerAxis(ax);
    }
    for (const rl of this.builtins.pressureRulesFor(world.id)) {
      this.pressures.registerRule(rl);
    }
    this.pressures.pruneInvalidRules();

    // A world's own cast replaces the shared one; mod creatures are re-applied.
    const npcDir = join(dir, "npcs");
    if (existsSync(npcDir)) {
      this.npcs.clear();
      this.npcLoader.loadDir(npcDir);
      this.npcLoader.reloadModDirs();
    }

    // The world's own rule definitions (layer onto the global library).
    const rulesDir = join(dir, "rules");
    if (existsSync(rulesDir)) this.ruleLoader.loadDir(rulesDir);

    // The world's own translations (per language), shadowing the base pack.
    this.loadWorldLanguage(dir);

    this.mods.applyScopedOverlay(cleared);
  }

  /** Install `resource/worlds/<id>/language/<code>.json` overlays, if any. */
  private loadWorldLanguage(dir: string): void {
    const langDir = join(dir, "language");
    if (!existsSync(langDir)) {
      clearWorldTranslations();
      return;
    }
    const map: Record<string, Record<string, string>> = {};
    for (const file of readdirSync(langDir)) {
      if (!file.endsWith(".json")) continue;
      const code = file.slice(0, -5);
      try {
        map[code] = JSON.parse(readFileSync(join(langDir, file), "utf-8"));
      } catch (err) {
        console.warn(`[world] 语言文件 ${file} 解析失败:`, (err as Error).message);
      }
    }
    setWorldTranslations(map);
  }
}
