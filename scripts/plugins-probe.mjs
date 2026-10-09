/**
 * Boot the game headlessly and report what the plugin kernel mounted: which
 * plugins loaded, and what they registered (status panels, console commands,
 * UI slots). The quick answer to "did my plugin actually load?".
 *
 * Run: npm run build && node scripts/plugins-probe.mjs
 */
import { container } from "../dist/Container.js";
import GameInitialization from "../dist/core/GameInitialization.js";
import PluginHost from "../dist/core/plugin/PluginHost.js";
import GameStatusMap from "../dist/core/registry/GameStatusMap.js";
import ReplRegistry from "../dist/core/repl/ReplRegistry.js";
import { UiSlotRegistry, SCREEN_SLOTS } from "../dist/core/plugin/ui.js";

await container.resolve(GameInitialization).init();
const host = container.resolve(PluginHost);

console.log("mounted plugins :", host.loadedIds().join(", ") || "(none)");
console.log("mods            :", host.getLoadedMods().map((m) => m.id).join(", ") || "(none)");
console.log("discovered      :", host.discover().length, "refs");
console.log("services        :", host.serviceIds().join(", ") || "(none)");
console.log("status views    :", container.resolve(GameStatusMap).getKeys().sort().join(","));
console.log("commands        :", container.resolve(ReplRegistry).all().length);
const slots = container.resolve(UiSlotRegistry);
for (const slot of Object.values(SCREEN_SLOTS)) {
  const best = slots.best(slot);
  console.log(`slot ${slot.padEnd(22)}:`, best ? `taken by ${best.owner}` : "free (built-in)");
}
// Key bindings ship as a plugin: check the page and the action list it owns.
const { SettingRegistry } = await import("../dist/core/registry/SettingRegistry.js");
const { default: KeyActionRegistry } = await import("../dist/core/registry/KeyActionRegistry.js");
console.log("settings pages  :", container.resolve(SettingRegistry).getKeys().join(", "));
console.log("key actions     :", container.resolve(KeyActionRegistry).effective().map((a) => `${a.id}=${a.defaultKey}`).join(" "));

process.exit(0);
