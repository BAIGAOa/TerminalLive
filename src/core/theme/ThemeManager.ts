import { Scope, Scoped, inject } from "di-wise";
import ThemeCenter from "./ThemeCenter.js";
import { Theme } from "./ThemeDefinition.js";

type Listener = () => void;

@Scoped(Scope.Container)
export default class ThemeManager {
  private themeCenter: ThemeCenter;
  private currentThemeId: string | null = null;
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.themeCenter = inject(ThemeCenter);
  }

  public subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  public setCurrent(id: string): void {
    if (!this.themeCenter.hasTheme(id)) {
      throw new Error(`主题 "${id}" 不存在`);
    }
    this.currentThemeId = id;
    this.notify();
  }

  public getCurrent(): Theme | null {
    if (!this.currentThemeId) return null;
    return this.themeCenter.getTheme(this.currentThemeId) ?? null;
  }

  public getCurrentId(): string | null {
    return this.currentThemeId;
  }

  public getSnapshot = (): Theme | null => this.getCurrent();
}