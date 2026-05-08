import { Scope, Scoped } from "di-wise";
import { Theme } from "./ThemeDefinition.js";

@Scoped(Scope.Container)
export default class ThemeCenter {
  private themes: Map<string, Theme> = new Map();

  public addTheme(theme: Theme): void {
    if (this.themes.has(theme.id)) {
      throw new Error(`主题 "${theme.id}" 已存在，不可重复注册`);
    }
    this.themes.set(theme.id, theme);
  }

  public removeTheme(id: string): void {
    if (!this.themes.has(id)) {
      throw new Error(`主题 "${id}" 不存在，无法删除`);
    }
    this.themes.delete(id);
  }

  public getAllTheme(): Theme[] {
    return Array.from(this.themes.values());
  }

  public getCount(): number {
    return this.themes.size;
  }

  public getTheme(id: string): Theme | undefined {
    return this.themes.get(id);
  }

  public hasTheme(id: string): boolean {
    return this.themes.has(id);
  }
}