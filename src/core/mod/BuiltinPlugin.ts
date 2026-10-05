import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import z from "zod";
import { inject } from "../../Container.js";
import ConfigStore from "../store/ConfigStore.js";
import { resourcePath } from "../paths.js";
import { autonomySchema } from "../../world/relationships/NpcDefinition.js";
import type { NpcAutonomyDef } from "../../world/relationships/NpcAutonomy.js";
import { pressureAxisSchema } from "../../world/pressures/PressureDefinition.js";
import { pressureRuleSchema } from "../../world/pressures/PressureRule.js";
import { worldRuleSchema, type WorldRuleDef } from "../../world/rules/WorldRule.js";

/**
 * Built-in plugins: data-only packages shipped in `resource/plugins/<id>/`
 * (a `plugin.json`). They extend one world (or every world) with extra NPC
 * behaviours, hidden-score axes and world rules — and can be turned on/off in
 * the config, exactly like user mods but bundled with the game.
 */
export const pluginManifestSchema = z.object({
  id: z.string(),
  nameKey: z.string(),
  descKey: z.string().optional(),
  /** Restrict to one world id; omit to apply to every world. */
  world: z.string().optional(),
  /** NPC autonomy behaviours added to that world's cast. */
  npcBehaviors: z.array(autonomySchema).default([]),
  /** Hidden-score axes + coupling rules. */
  pressures: z
    .object({
      axes: z.array(pressureAxisSchema).default([]),
      rules: z.array(pressureRuleSchema).default([]),
    })
    .default({ axes: [], rules: [] }),
  /** World rules this plugin activates for its world. */
  worldRules: z.array(worldRuleSchema).default([]),
});

export type BuiltinPluginDef = z.infer<typeof pluginManifestSchema>;

export interface LoadedBuiltinPlugin {
  dir: string;
  def: BuiltinPluginDef;
}

/**
 * Loads and holds the built-in plugins. Only plugins whose id is enabled in the
 * config are installed (`enabledBuiltinPlugins`; absent = all built-ins on).
 */
export default class BuiltinPluginRegistry {
  private plugins: LoadedBuiltinPlugin[] = [];
  private loaded = false;

  public load(): void {
    if (this.loaded) return;
    this.loaded = true;

    const enabled = inject(ConfigStore).getEnabledBuiltinPlugins();
    const root = resourcePath("plugins");
    if (!existsSync(root)) return;

    for (const name of readdirSync(root)) {
      const dir = join(root, name);
      const manifestPath = join(dir, "plugin.json");
      if (!existsSync(manifestPath)) continue;
      let def: BuiltinPluginDef;
      try {
        def = pluginManifestSchema.parse(
          JSON.parse(readFileSync(manifestPath, "utf-8")),
        );
      } catch (err) {
        console.error(`[builtin-plugin] ${name} 解析失败:`, (err as Error).message);
        continue;
      }
      if (enabled !== null && !enabled.includes(def.id)) continue;
      this.plugins.push({ dir, def });
    }
  }

  public all(): LoadedBuiltinPlugin[] {
    return this.plugins;
  }

  /** Plugins that apply to a world (its own + universal ones). */
  private forWorld(worldId: string): BuiltinPluginDef[] {
    return this.plugins
      .map((p) => p.def)
      .filter((d) => d.world === undefined || d.world === worldId);
  }

  public behaviorsFor(worldId: string): NpcAutonomyDef[] {
    return this.forWorld(worldId).flatMap((d) => d.npcBehaviors as NpcAutonomyDef[]);
  }

  public worldRuleIdsFor(worldId: string): string[] {
    return this.forWorld(worldId)
      .flatMap((d) => d.worldRules)
      .map((r) => r.id);
  }

  public pressureAxesFor(worldId: string) {
    return this.forWorld(worldId).flatMap((d) => d.pressures.axes);
  }

  public pressureRulesFor(worldId: string) {
    return this.forWorld(worldId).flatMap((d) => d.pressures.rules);
  }

  /** Every built-in plugin id on disk (whether or not it is enabled). */
  public available(): string[] {
    const root = resourcePath("plugins");
    if (!existsSync(root)) return [];
    const out: string[] = [];
    for (const name of readdirSync(root)) {
      const manifestPath = join(root, name, "plugin.json");
      if (!existsSync(manifestPath)) continue;
      try {
        out.push((JSON.parse(readFileSync(manifestPath, "utf-8")) as { id: string }).id);
      } catch {
        /* skip unreadable */
      }
    }
    return out.sort();
  }

  public isEnabled(id: string): boolean {
    return this.plugins.some((p) => p.def.id === id);
  }

  public allWorldRules(): WorldRuleDef[] {
    return this.plugins.flatMap((p) => p.def.worldRules);
  }
}
