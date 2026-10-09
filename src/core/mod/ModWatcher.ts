import { FSWatcher, watch } from "node:fs";
import { inject } from "../../Container.js";
import ModMonitor from "./ModMonitor.js";
import PluginHost from "../plugin/PluginHost.js";
import TypedEventBus from "../TypedEventBus.js";

/**
 * Watches the mod root and hot-reloads enabled plugins when files change.
 * Debounced so a burst of writes triggers a single reload.
 */
export default class ModWatcher {
  private registry: ModMonitor;
  private loader: PluginHost;
  private bus: TypedEventBus;

  private watcher: FSWatcher | null = null;
  private timer: NodeJS.Timeout | null = null;
  private static readonly DEBOUNCE_MS = 400;

  constructor() {
    this.registry = inject(ModMonitor);
    this.loader = inject(PluginHost);
    this.bus = inject(TypedEventBus);
  }

  public get active(): boolean {
    return this.watcher !== null;
  }

  /** Begin watching. Idempotent. Returns true if watching is now active. */
  public start(): boolean {
    if (this.watcher) return true;
    try {
      this.watcher = watch(
        this.registry.MOD_ROOT,
        { recursive: true },
        (_event, file) => {
          if (file && !/\.(js|json)$/i.test(file)) return;
          this.schedule();
        },
      );
      // A watch root deleted/renamed mid-run emits 'error'; without a handler
      // Node throws it as an unhandled error and crashes the game.
      this.watcher.on("error", (err) => {
        console.warn("[Mod] 监听出错:", err.message);
        this.stop();
      });
      return true;
    } catch (err) {
      console.warn("[Mod] 无法监听模组目录:", (err as Error).message);
      this.watcher = null;
      return false;
    }
  }

  public stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.watcher?.close();
    this.watcher = null;
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.reloadNow();
    }, ModWatcher.DEBOUNCE_MS);
  }

  /** Reload immediately (also used by the `mods-reload` console command). */
  public reloadNow(): number {
    try {
      this.loader.reloadEnabled();
    } catch (err) {
      console.error("[Mod] 热重载失败:", (err as Error).message);
    }
    const count = this.loader.getLoadedMods().length;
    this.bus.emit("moder:reloaded", { count });
    return count;
  }
}
