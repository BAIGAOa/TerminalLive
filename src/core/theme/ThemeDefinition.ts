import z from "zod";

export const ThemeColorSchema = z.object({
  primary: z.string().default("cyan"),
  secondary: z.string().default("green"),
  background: z.string().default("black"),
  text: z.string().default("white"),
  textDim: z.string().default("gray"),
  border: z.string().default("gray"),

  highlight: z.string().default("green"),
  highlightBackground: z.string().default("green"),

  success: z.string().default("green"),
  warning: z.string().default("yellow"),
  error: z.string().default("red"),
  info: z.string().default("cyan"),
  danger: z.string().default("red"),
  muted: z.string().default("gray"),

  health: z.string().default("green"),
  healthLow: z.string().default("red"),
  anger: z.string().default("red"),
  excitement: z.string().default("yellow"),
  depression: z.string().default("blue"),
  weakness: z.string().default("white"),
  money: z.string().default("yellow"),

  console: z.string().default("redBright"),
  consoleBorder: z.string().default("redBright"),

  achievement: z.string().default("green"),
  achievementLocked: z.string().default("gray"),

  logoTerm: z.string().default("cyan"),
  logoLive: z.string().default("green"),

  message: z.string().default("white"),
  messageSuccess: z.string().default("green"),
  messageError: z.string().default("red"),

  menuTitle: z.string().default("yellow"),
  menuBorder: z.string().default("gray"),
  cardBorder: z.string().default("gray"),
  cardTitle: z.string().default("white"),

  progressBar: z.string().default("green"),
  progressBarBg: z.string().default("gray"),

  levelLocked: z.string().default("gray"),
  levelUnlocked: z.string().default("yellow"),
  levelCompleted: z.string().default("green"),
  levelSelected: z.string().default("white"),

  inputCursor: z.string().default("gray"),
  inputText: z.string().default("white"),

  settingTitle: z.string().default("gray"),

  modEnabled: z.string().default("green"),
  modDisabled: z.string().default("gray"),

  archiveTimestamp: z.string().default("cyan"),
  archiveName: z.string().default("white"),
});

export const ThemeSchema = z.object({
  id: z.string(),
  nameKey: z.string(),
  descriptionKey: z.string().default(""),
  colors: ThemeColorSchema,
});

export type ThemeColors = z.infer<typeof ThemeColorSchema>;
export type Theme = z.infer<typeof ThemeSchema>;