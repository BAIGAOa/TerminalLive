import { useCallback, useMemo, useState } from "react";
import { container } from "../Container.js";
import ConfigStore from "../core/store/ConfigStore.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useWindowSize } from "ink";
import PluginHost from "../core/plugin/PluginHost.js";
import { isPluginEnabled, type PluginEnablement } from "../core/plugin/sources.js";
import {
  buildPluginView,
  togglePluginEnabled,
  toggleTrusted,
  type PluginManagerView,
} from "../ui/pluginManagerView.js";

export interface PluginScreenData {
  view: PluginManagerView;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  /** Turn a plugin on or off (takes effect on reload). */
  togglePlugin: (index: number) => void;
  /** Let a plugin run with full host access, or put it back in the sandbox. */
  toggleTrust: (index: number) => void;
  /** Re-mount every enabled plugin without restarting the game. */
  reload: () => void;
  rows: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * The plugin manager. Lists every plugin the kernel found — shipped with the
 * game or installed as a mod — through the same host that loads them, so what
 * the screen shows is exactly what the game would run.
 */
export function useModScreen(): PluginScreenData {
  const { t } = useI18n();
  const { rows } = useWindowSize();
  const host = container.resolve(PluginHost);
  const configStore = container.resolve(ConfigStore);

  const [selectedIndex, setSelectedIndex] = useState(0);
  // Bumped on every toggle: the view is derived from config + disk, neither of
  // which is reactive on its own.
  const [revision, setRevision] = useState(0);

  const refs = useMemo(() => host.discover(), [host, revision]);
  const enablement = useMemo<PluginEnablement>(
    () => ({
      mods: configStore.getEnabledMods(),
      builtins: configStore.getEnabledBuiltinPlugins(),
      disabled: configStore.getDisabledPlugins(),
    }),
    [configStore, revision],
  );
  const trusted = useMemo(
    () => configStore.getTrustedPlugins(),
    [configStore, revision],
  );

  const view = useMemo(
    () => buildPluginView(refs, enablement, trusted, t),
    [refs, enablement, trusted, t],
  );

  const togglePlugin = useCallback(
    (index: number) => {
      const row = view.all[index];
      if (!row) return;
      const ref = refs.find(
        (r) => (r.source === "mod" ? r.dirName : r.id) === row.key,
      );
      if (!ref) return;
      // Which shipped plugins are on *right now*, including the opt-ins that a
      // `null` list leaves off — materialising from every id on disk would
      // count them as on and turn the first press into a no-op.
      const enabledBuiltinIds = refs
        .filter((r) => r.source === "builtin" && isPluginEnabled(r, enablement))
        .map((r) => r.id);
      const next = togglePluginEnabled(ref, enablement, enabledBuiltinIds);

      // Write only the list that changed. Persisting all three would turn a
      // `null` (`"every shipped plugin on"`) into `[]` — the moment the player
      // toggled a mod, every plugin the game ships with would switch off.
      if (next.mods !== enablement.mods) {
        void configStore.setEnabledMods([...next.mods]);
      }
      if (next.builtins !== enablement.builtins) {
        void configStore.setEnabledBuiltinPlugins([...(next.builtins ?? [])]);
      }
      if (next.disabled !== enablement.disabled) {
        void configStore.setDisabledPlugins([...(next.disabled ?? [])]);
      }
      setRevision((r) => r + 1);
    },
    [view, refs, enablement, configStore],
  );

  const toggleTrust = useCallback(
    (index: number) => {
      const row = view.all[index];
      if (!row) return;
      void configStore.setTrustedPlugins(toggleTrusted(trusted, row.id));
      setRevision((r) => r + 1);
    },
    [view, trusted, configStore],
  );

  const reload = useCallback(() => {
    host.reloadEnabled();
    setRevision((r) => r + 1);
  }, [host]);

  return {
    view,
    selectedIndex,
    setSelectedIndex,
    togglePlugin,
    toggleTrust,
    reload,
    rows,
    t,
  };
}

