import { Scope, Scoped } from "di-wise";
import React from "react";
import BaseRegistry from "./BaseRegistry.js";

export interface SettingEntry {
  component: React.ComponentType<any>;
  nameKey: string;
}

@Scoped(Scope.Container)
export class SettingRegistry extends BaseRegistry<SettingEntry> {}
