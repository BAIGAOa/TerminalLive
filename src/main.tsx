#!/usr/bin/env node

import React from 'react'
import { Box, render, Text, useInput } from 'ink'
import MainInterface from './ui/MainInterface.js'
import Logo from './ui/Logo.js'
import { LanguageProvider } from './core/language/LanguageContext.js'
import ControlConsole from './ui/ControlConsole.js'
import { TerminalSizeProvider } from './ui/TerminalSizeContext.js'
import { useApp } from './hooks/useApp.js'
import GameInitialization from './core/GameInitialization.js'
import { container } from './Container.js'
import { ScreenRegistry } from './core/store/ScreenRegistry.js'
import { KeyboardManager } from './core/keys/KeyBoardManager.js'
import { ThemeProvider, useThemeColors } from './hooks/theme/ThematicCommunicator.js'


const app = await container.resolve(GameInitialization).init()

function App() {
  const data = useApp()
  const registry = container.resolve(ScreenRegistry)
  const manager = container.resolve(KeyboardManager)
  const colors = useThemeColors()

  useInput((input, key) => {
    manager.handle(input, key)
  })

  const entry = registry.getEntry(data.currentScreen)
  const ctx = {
    player: app.player,
    setMonitor: (m: any) => { app.monitor = m },
  }

  let mainContent: React.ReactNode
  if (entry) {
    mainContent = <entry.component {...(entry.props?.(ctx) ?? {})} />
  } else {
    mainContent = (
      <Box
        width="100%"
        height="100%"
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
        padding={1}
      >
        <Logo marginBottom={2} />
        {registry.getMainMenuEntries().map((e) => (
          <MainInterface
            key={e.scene}
            title={data.t(e.nameKey)}
            backgroundColor={colors.background}
            width={40}
            height={5}
            marginTop={-3}
            isHighlighted={data.highlighting === e.highlightId}
          />
        ))}
        <MainInterface
          backgroundColor={colors.background}
          title={data.t('main.exit')}
          width={40}
          height={5}
          marginTop={-3}
          isHighlighted={data.highlighting === 'exit'}
        />
      </Box>
    )
  }

  return (
    <Box flexDirection="column" width="100%" height="100%">
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        {mainContent}
      </Box>
      {!data.consoleVisible && data.consoleUnreadCount > 0 && (
        <Box
          height={4}
          width="100%"
          borderStyle="double"
          borderColor="cyanBright"
        >
          <Box justifyContent="center">
            <Text color={colors.warning}>
              📢 {data.consoleUnreadCount} {data.t('console.unread')} [P]
            </Text>
          </Box>
        </Box>
      )}
      {data.consoleVisible && <ControlConsole />}
    </Box>
  )
}

render(
  <LanguageProvider>
    <TerminalSizeProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </TerminalSizeProvider>
  </LanguageProvider>,
)
