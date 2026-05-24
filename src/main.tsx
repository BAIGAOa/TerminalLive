#!/usr/bin/env node

import React, { useEffect, useCallback, useRef } from 'react';
import { Box, Text, render } from 'ink';
import { useSyncExternalStore } from 'react';
import { LanguageProvider, useI18n } from './core/language/LanguageContext.js';
import { TerminalSizeProvider } from './ui/TerminalSizeContext.js';
import { ThemeProvider, useThemeColors } from './hooks/theme/ThematicCommunicator.js';
import {
  registerComponent,
  ScenarioManagementProvider,
  CurrentScreen,
  useScreenSystem,
  KeyboardProvider,
  useKeyboard,
  SelectInput,
  overlay,
  closeOverlay,
  gotoScreen as moduleGotoScreen,
} from '@baigao_h/ink-kit';
import type { Item } from '@baigao_h/ink-kit';
import GameInitialization from './core/GameInitialization.js';
import { container } from './Container.js';
import ConsoleStore from './core/console/ConsoleStore.js';
import Logo from './ui/Logo.js';
import LevelSelection from './ui/LevelSelection.js';
import LevelDetail from './ui/LevelDetail.js';
import LevelGame from './ui/LevelGame.js';
import Setting from './ui/Setting.js';
import PlayerConfig from './ui/PlayerConfig.js';
import ModManager from './ui/ModManager.js';
import ThemeScreen from './ui/ThemeScreen.js';
import Language from './ui/Language.js';
import AchievementScreen from './ui/Achievement.js';
import Archive from './ui/Archive.js';
import ControlConsole from './ui/ControlConsole.js';
import { SettingRegistry } from './core/registry/SettingRegistry.js';

// ── 初始化游戏核心 ──
await container.resolve(GameInitialization).init();



let _MenuComponent: React.ComponentType<any>;
const MenuPlaceholder = ((props: any) =>
  React.createElement(_MenuComponent, props)) as React.ComponentType<any>;
MenuPlaceholder.displayName = 'MenuPlaceholder';

registerComponent(MenuPlaceholder, {});

registerComponent(LevelSelection, {}, { parent: MenuPlaceholder });
registerComponent(LevelDetail, {} as any, { parent: LevelSelection });
registerComponent(LevelGame, {}, { parent: LevelSelection });  
registerComponent(Setting, {}, { parent: MenuPlaceholder });
registerComponent(PlayerConfig, {} as any, { parent: Setting });
registerComponent(ModManager, {}, { parent: Setting });
registerComponent(ThemeScreen, {}, { parent: Setting });
registerComponent(Language, {}, { parent: MenuPlaceholder });
registerComponent(AchievementScreen, {}, { parent: MenuPlaceholder });
registerComponent(Archive, {}, { parent: MenuPlaceholder });
registerComponent(ControlConsole, {});

// 设置子页面注册到 SettingRegistry（供 Setting 组件动态渲染）
const settingReg = container.resolve(SettingRegistry);
settingReg.register("playerConfig", { component: PlayerConfig, nameKey: "setting.playerConfig" });
settingReg.register("modManager", { component: ModManager, nameKey: "setting.modManager" });
settingReg.register("theme", { component: ThemeScreen, nameKey: "setting.theme" });

function MenuItem({ label, isSelected }: { label: string; value: string; isSelected: boolean }) {
  const colors = useThemeColors();
  return (
    <Box
      width={40}
      height={3}
      borderStyle="bold"
      borderColor={isSelected ? colors.highlight : colors.muted}
      justifyContent="center"
      alignItems="center"
      marginBottom={1}
    >
      <Text color={isSelected ? colors.highlight : colors.text} bold={isSelected}>
        {label}
      </Text>
    </Box>
  );
}

function MenuIndicator({ isSelected }: { isSelected: boolean }) {
  const colors = useThemeColors();
  return (
    <Box marginRight={1}>
      <Text color={isSelected ? colors.highlight : undefined}>
        {isSelected ? '❯' : ' '}
      </Text>
    </Box>
  );
}

function Menu() {
  const { t } = useI18n();
  const { skip } = useScreenSystem();

  const items: Item<string>[] = [
    { label: t('main.startGame'), value: 'levelSelection' },
    { label: t('main.enterConfig'), value: 'config' },
    { label: t('main.configurationLanguage'), value: 'language' },
    { label: t('main.achievement'), value: 'achievement' },
    { label: t('main.archive'), value: 'archive' },
    { label: t('main.exit'), value: 'exit' },
  ];

  const handleSelect = useCallback(
    (item: Item<string>) => {
      switch (item.value) {
        case 'levelSelection':
          skip(LevelSelection, {});
          break;
        case 'config':
          skip(Setting, {});
          break;
        case 'language':
          skip(Language, {});
          break;
        case 'achievement':
          skip(AchievementScreen, {});
          break;
        case 'archive':
          skip(Archive, {});
          break;
        case 'exit':
          process.exit(0);
          break;
      }
    },
    [skip],
  );

  return (
    <Box
      width="100%"
      height="100%"
      alignItems="center"
      justifyContent="center"
      flexDirection="column"
      padding={1}
    >
      <Logo marginBottom={2} />
      <SelectInput
        items={items}
        onSelect={handleSelect as any}
        focusId="main-menu"
        limit={10}
        itemComponent={MenuItem as any}
        indicatorComponent={MenuIndicator}
      />
    </Box>
  );
}

_MenuComponent = Menu;



function App() {
  const { globalKeys } = useKeyboard();
  const colors = useThemeColors();
  const { t } = useI18n();
  const consoleStore = container.resolve(ConsoleStore);
  const consoleSnap = useSyncExternalStore(
    consoleStore.subscribe,
    () => consoleStore.getSnapshot(),
  );
  const { currentPath } = useScreenSystem();

  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;

  useEffect(() => {
    globalKeys([
      {
        key: 'p',
        operate: () => {
          const snap = consoleStore.getSnapshot();
          if (snap.visible) {
            closeOverlay();
          } else {
            overlay(ControlConsole, {});
          }
          consoleStore.toggle();
        },
        category: '*',
        cover: true,
        affectOverlay: false,
      },
      {
        key: 'q',
        operate: () => {
          const top = currentPathRef.current[currentPathRef.current.length - 1];
          if (top !== MenuPlaceholder && top !== _MenuComponent) {
            moduleGotoScreen(MenuPlaceholder, {});
          }
        },
        category: '*',
        cover: true,
        affectOverlay: false,
      },
    ]);
  }, [globalKeys, consoleStore]);

  return (
    <Box flexDirection="column" width="100%" height="100%">
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <CurrentScreen />
      </Box>
      {!consoleSnap.visible && consoleSnap.unreadCount > 0 && (
        <Box
          height={4}
          width="100%"
          borderStyle="double"
          borderColor="cyanBright"
        >
          <Box justifyContent="center">
            <Text color={colors.warning}>
              {'📢 '}
              {consoleSnap.unreadCount}
              {' '}
              {t('console.unread')}
              {' [P]'}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}


render(
  <LanguageProvider>
    <TerminalSizeProvider>
      <ThemeProvider>
        <ScenarioManagementProvider defaultScreen={MenuPlaceholder}>
          <KeyboardProvider>
            <App />
          </KeyboardProvider>
        </ScenarioManagementProvider>
      </ThemeProvider>
    </TerminalSizeProvider>
  </LanguageProvider>,
);