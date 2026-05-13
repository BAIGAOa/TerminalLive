import { Scope, Scoped } from "di-wise";
import React from "react";
import BaseRegistry from "./BaseRegistry.js";
import Player from "../../world/Player.js";
import KeyboardMonitor from "../keys/KeyboardMonitor.js";

export interface ScreenEntry {
  component: React.ComponentType<any>;
  nameKey: string;
  highlightId: string;
  hide?: boolean;
  props?: (ctx: ScreenContext) => Record<string, any>;
}

export interface ScreenContext {
  player: Player;
  setMonitor: (m: KeyboardMonitor) => void;
}

@Scoped(Scope.Container)
export class ScreenRegistry extends BaseRegistry<ScreenEntry> {
  public getMainMenuEntries() {
    return Array.from(this.entries).filter((each) => each[1].hide !== true);
  }
}
