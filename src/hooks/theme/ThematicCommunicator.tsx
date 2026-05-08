import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { container } from "../../Container.js";
import ThemeManager from "../../core/theme/ThemeManager.js";
import { Theme, ThemeColors } from "../../core/theme/ThemeDefinition.js";

const defaultColors: ThemeColors = {
  primary: "cyan",
  secondary: "green",
  background: "black",
  text: "white",
  textDim: "gray",
  border: "gray",
  highlight: "green",
  highlightBackground: "green",
  success: "green",
  warning: "yellow",
  error: "red",
  info: "cyan",
  danger: "red",
  muted: "gray",
  health: "green",
  healthLow: "red",
  anger: "red",
  excitement: "yellow",
  depression: "blue",
  weakness: "white",
  money: "yellow",
  console: "redBright",
  consoleBorder: "redBright",
  achievement: "green",
  achievementLocked: "gray",
  logoTerm: "cyan",
  logoLive: "green",
  message: "white",
  messageSuccess: "green",
  messageError: "red",
  menuTitle: "yellow",
  menuBorder: "gray",
  cardBorder: "gray",
  cardTitle: "white",
  progressBar: "green",
  progressBarBg: "gray",
  levelLocked: "gray",
  levelUnlocked: "yellow",
  levelCompleted: "green",
  levelSelected: "white",
  inputCursor: "gray",
  inputText: "white",
  settingTitle: "gray",
  modEnabled: "green",
  modDisabled: "gray",
  archiveTimestamp: "cyan",
  archiveName: "white",
};

interface ThemeContextType {
  theme: Theme | null;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: null,
  colors: defaultColors,
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const manager = container.resolve(ThemeManager);
    const unsubscribe = manager.subscribe(() => {
      setTheme(manager.getCurrent());
    });
    setTheme(manager.getCurrent());
    return () => {
      unsubscribe();
    };
  }, []);

  const colors = theme?.colors ?? defaultColors;

  return (
    <ThemeContext.Provider value={{ theme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeColors = (): ThemeColors => {
  const context = useContext(ThemeContext);
  return context.colors;
};

export const useTheme = (): ThemeContextType => {
  return useContext(ThemeContext);
};