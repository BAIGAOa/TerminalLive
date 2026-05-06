import { Scope, Scoped } from "di-wise";
import React from "react";
import Player from "../../world/Player.js";
import KeyboardMonitor from "../keys/KeyboardMonitor.js";

export interface ScreenEntry {
    scene: string; // 字符串 ID，内置 SCENES.xxx 或模组自定义
    component: React.ComponentType<any>;
    nameKey: string;
    highlightId: string;
    hide?: boolean
    props?: (ctx: ScreenContext) => Record<string, any>;
}

export interface ScreenContext {
    player: Player;
    setMonitor: (m: KeyboardMonitor) => void;
}

/**
 * 所有场景的注册表。
 * 模组通过 ModContext.registerScreen 在此注册新场景 UI。
 */
@Scoped(Scope.Container)
export class ScreenRegistry {
    private entries = new Map<string, ScreenEntry>();

    public register(entry: ScreenEntry): void {
        this.entries.set(entry.scene, entry);
    }

    public getEntry(scene: string): ScreenEntry | undefined {
        return this.entries.get(scene);
    }

    public getMainMenuEntries(): ScreenEntry[] {
        return Array.from(this.entries.values()).filter(each => {
            return each.hide !== true
        });
    }
}
