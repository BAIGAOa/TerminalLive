#!/usr/bin/env node

import React, { useEffect } from "react";
import { Box, Text, render } from "ink";
import { useSyncExternalStore } from "react";
import {
  CurrentScreen,
  KeyboardProvider,
  ScenarioManagementProvider,
  gotoScreen,
  registerComponent,
  useKeyboard,
} from "ink-cartridge";
import { LanguageProvider, useI18n } from "./core/language/LanguageContext.js";
import { TerminalSizeProvider } from "./ui/TerminalSizeContext.js";
import {
  ThemeProvider,
  useThemeColors,
} from "./hooks/theme/ThematicCommunicator.js";
import GameInitialization from "./core/GameInitialization.js";
import { container } from "./Container.js";
import ConsoleStore from "./core/console/ConsoleStore.js";
import ConfigStore from "./core/store/ConfigStore.js";
import { SettingRegistry } from "./core/registry/SettingRegistry.js";
import { resolveKeymap } from "./ui/keymap.js";
import MainMenu from "./ui/MainMenu.js";
import WorldSelection from "./ui/WorldSelection.js";
import WorldGame from "./ui/WorldGame.js";
import Setting from "./ui/Setting.js";
import PlayerConfig from "./ui/PlayerConfig.js";
import ModManager from "./ui/ModManager.js";
import ThemeScreen from "./ui/ThemeScreen.js";
import Language from "./ui/Language.js";
import AchievementScreen from "./ui/Achievement.js";
import Archive from "./ui/Archive.js";
import Traits from "./ui/Traits.js";
import Shop from "./ui/Shop.js";
import Codex from "./ui/Codex.js";
import Lineage from "./ui/Lineage.js";
import KeyBinding from "./ui/KeyBinding.js";
import { ToastHost } from "./ui/ToastHost.js";
import { HelpModal } from "./ui/HelpModal.js";
import { dismissModal, presentModal } from "./ui/layers/modalBus.js";
import { toggleConsole } from "./ui/layers/consoleLayer.js";
import { registerStatusViews } from "./ui/gameStatus/registerStatusViews.js";
import { replInput } from "./core/repl/replInputState.js";

// ── 初始化游戏核心 ──
await container.resolve(GameInitialization).init();
// UI layer wires the status-view components into GameStatusMap (keeps content UI-free).
registerStatusViews();

// ── 注册屏幕树 ──
registerComponent(MainMenu, {});
registerComponent(WorldSelection, {}, { parent: MainMenu });
registerComponent(WorldGame, {}, { parent: WorldSelection });
registerComponent(Setting, {}, { parent: MainMenu });
registerComponent(PlayerConfig, {}, { parent: Setting });
registerComponent(ModManager, {}, { parent: Setting });
registerComponent(ThemeScreen, {}, { parent: Setting });
registerComponent(KeyBinding, {}, { parent: Setting });
registerComponent(Language, {}, { parent: MainMenu });
registerComponent(AchievementScreen, {}, { parent: MainMenu });
registerComponent(Archive, {}, { parent: MainMenu });
registerComponent(Traits, {}, { parent: MainMenu });
registerComponent(Shop, {}, { parent: MainMenu });
registerComponent(Codex, {}, { parent: MainMenu });
registerComponent(Lineage, {}, { parent: MainMenu });

// 设置子页面注册到 SettingRegistry（供 Setting 组件动态渲染）
const settingReg = container.resolve(SettingRegistry);
settingReg.register("playerConfig", {
  component: PlayerConfig,
  nameKey: "setting.playerConfig",
});
settingReg.register("modManager", {
  component: ModManager,
  nameKey: "setting.modManager",
});
settingReg.register("theme", {
  component: ThemeScreen,
  nameKey: "setting.theme",
});
settingReg.register("keyboard", {
  component: KeyBinding,
  nameKey: "setting.keyBoardConfig",
});

function NotificationBanner() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const consoleStore = container.resolve(ConsoleStore);
  const snap = useSyncExternalStore(
    consoleStore.subscribe,
    consoleStore.getSnapshot,
  );
  if (snap.visible || snap.unreadCount === 0) return null;
  return (
    <Box height={3} width="100%" borderStyle="bold" borderColor="cyanBright">
      <Box justifyContent="center">
        <Text color={colors.warning}>
          {"📢 "}
          {snap.unreadCount} {t("console.unread")} {" [P]"}
        </Text>
      </Box>
    </Box>
  );
}

function App() {
  const { globalKeys, globalSequence } = useKeyboard();
  const configStore = container.resolve(ConfigStore);
  const keymapJson = useSyncExternalStore(configStore.subscribe, () =>
    JSON.stringify(configStore.getKeyBindings()),
  );
  const keymap = resolveKeymap(JSON.parse(keymapJson));
  // While the pseudo-terminal is capturing input, the letter shortcuts must not
  // steal keystrokes from the prompt.
  const typing = useSyncExternalStore(
    replInput.subscribe,
    replInput.isTyping,
  );

  useEffect(() => {
    if (typing) {
      globalKeys([], { mode: "replace" });
      globalSequence([], { mode: "replace" });
      return;
    }
    globalKeys([
      {
        key: keymap.console,
        operate: () => toggleConsole(),
        category: "*",
        cover: true,
      },
      {
        key: keymap.help,
        operate: () =>
          presentModal(
            "help-layer",
            HelpModal,
            { onClose: () => dismissModal("help-layer") },
            1100,
          ),
        category: "*",
        cover: true,
      },
      {
        key: keymap.menu,
        operate: () => gotoScreen(MainMenu, {}),
        category: "*",
        cover: true,
      },
    ]);
    globalSequence([
      { keys: ["g", "o"], operate: () => toggleConsole(), category: "*" },
    ]);
  }, [
    globalKeys,
    globalSequence,
    keymap.console,
    keymap.help,
    keymap.menu,
    typing,
  ]);

  return (
    <Box
      flexDirection="column"
      width="100%"
      height="100%"
    >
      <ToastHost />
      <Box flexGrow={1}>
        <CurrentScreen />
      </Box>
      <NotificationBanner />
    </Box>
  );
}

/**
 * Last-resort recovery screen. Rendered INSIDE KeyboardProvider so it can grab
 * a global key; a render throw anywhere in the tree lands here instead of
 * tearing the whole TUI down with a raw stack trace.
 */
function RecoveryPrompt({ error, onReset }: { error: Error; onReset: () => void }) {
  const { globalKeys } = useKeyboard();
  useEffect(() => {
    globalKeys([{ key: "r", operate: onReset, category: "*", cover: true }]);
  }, [globalKeys, onReset]);
  return (
    <Box flexDirection="column" padding={1}>
      <Text color="red" bold>
        ⚠ 渲染出错 / Render error
      </Text>
      <Text dimColor>{error.message}</Text>
      <Text>按 R 返回主菜单 / Press R to return to the main menu</Text>
    </Box>
  );
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("[UI] 渲染异常:", error);
  }
  private reset = () => this.setState({ error: null });
  render() {
    if (this.state.error) {
      return <RecoveryPrompt error={this.state.error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}

render(
  <LanguageProvider>
    <TerminalSizeProvider>
      <ThemeProvider>
        <ScenarioManagementProvider defaultScreen={MainMenu} fullScreen>
          <KeyboardProvider
            mouse
            autoTab
            modes={["normal", "insert"]}
            defaultMode="normal"
          >
            <AppErrorBoundary>
              <App />
            </AppErrorBoundary>
          </KeyboardProvider>
        </ScenarioManagementProvider>
      </ThemeProvider>
    </TerminalSizeProvider>
  </LanguageProvider>,
);
