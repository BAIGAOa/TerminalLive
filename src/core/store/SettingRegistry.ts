import { Scope, Scoped } from "di-wise";
import React from "react";

export interface SettingEntry {
  menu: string;
  component: React.ComponentType<any>;
  nameKey: string;
}


@Scoped(Scope.Container)
export class SettingRegistry {
  private entries = new Map<string, SettingEntry>();

  public register(entry: SettingEntry): void {
    this.entries.set(entry.menu, entry);
  }

  public getEntry(menu: string): SettingEntry | undefined {
    return this.entries.get(menu);
  }

  public getAll(): SettingEntry[] {
    return Array.from(this.entries.values());
  }
}