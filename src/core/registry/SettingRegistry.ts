import React from "react";
import BaseRegistry from "./BaseRegistry.js";

export interface SettingEntry {
  component: React.ComponentType<any>;
  nameKey: string;
}

export class SettingRegistry extends BaseRegistry<SettingEntry> {}
