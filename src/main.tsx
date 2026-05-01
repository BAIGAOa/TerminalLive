import React from 'react';
import { Box, render, Text } from 'ink';
import MainInterface from './ui/MainInterface.js';
import Logo from './ui/Logo.js';
import { PlayerDashboard } from './ui/Game.js';
import Language from './ui/Language.js';
import { LanguageProvider } from './core/language/LanguageContext.js';
import { Scenes } from './types/Scenes.js';
import Setting from './ui/Setting.js';
import AchievementScreen from './ui/Achievement.js';
import ControlConsole from './ui/ControlConsole.js';
import { TerminalSizeProvider } from './ui/TerminalSizeContext.js';
import { useApp } from './hooks/useApp.js';
import GameInitialization from './core/GameInitialization.js';
import { useKeyboardMonitor } from './core/keys/KeyboardMonitor.js';
import { container } from './Container.js';

//初始化

const app = await container.resolve(GameInitialization).init()



function App() {
  const data = useApp();

  useKeyboardMonitor(app.monitor);

  let mainContent: React.ReactNode;
  if (data.currentScreen === Scenes.game) {
    mainContent = <PlayerDashboard player={app.player} />;
  } else if (data.currentScreen === Scenes.config) {
    mainContent = <Setting onConfigChange={(m) => { app.monitor = m; }} player={app.player} />;
  } else if (data.currentScreen === Scenes.language) {
    mainContent = <Language />;
  } else if (data.currentScreen === Scenes.achievement) {
    mainContent = <AchievementScreen />;
  } else {
    mainContent = (
      <Box width="100%" height="100%" alignItems="center" justifyContent="center"
        flexDirection="column" padding={1}>
        <Logo termColor="cyan" liveColor="green" marginBottom={2} />
        <MainInterface title={data.t('main.startGame')} backgroundColor="black"
          width={40} height={5}
          isHighlighted={data.highlighting === 'start'} />
        <MainInterface title={data.t('main.enterConfig')} width={40} backgroundColor="black"
          height={5} marginTop={-3}
          isHighlighted={data.highlighting === 'config'} />
        <MainInterface backgroundColor="black" title={data.t('main.configurationLanguage')}
          width={40} height={5} marginTop={-3}
          isHighlighted={data.highlighting === 'language'} />
        <MainInterface backgroundColor="black" title={data.t('main.achievement')}
          width={40} height={5} marginTop={-3}
          isHighlighted={data.highlighting === 'achievement'} />
        <MainInterface backgroundColor="black" title={data.t('main.exit')}
          width={40} height={5} marginTop={-3}
          isHighlighted={data.highlighting === 'exit'} highlightBackgroundColor="red" />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%" height="100%">
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        {mainContent}
      </Box>

      {!data.consoleVisible && data.consoleUnreadCount > 0 && (
        <Box height={4} width='100%' borderStyle='double' borderColor='cyanBright'>
          <Box justifyContent="center">
            <Text color="yellow">
              📢 {data.consoleUnreadCount} {data.t('console.unread')} [P]
            </Text>
          </Box>
        </Box>
      )}

      {data.consoleVisible && <ControlConsole />}
    </Box>
  );
}


render(
  <LanguageProvider>
    <TerminalSizeProvider>
      <App />
    </TerminalSizeProvider>
  </LanguageProvider>,
);
