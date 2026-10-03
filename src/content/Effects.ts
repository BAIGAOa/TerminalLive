import { container } from "../Container.js";
import EffectRegistry from "../world/effects/EffectRegistry.js";
import { EffectDefinition } from "../world/effects/EffectDefinition.js";

/**
 * Built-in status effects. Psych-driven ones (fx_rage / fx_mania / fx_gloom /
 * fx_fatigue) are spawned automatically by `Player.syncPsychEffects`; the rest
 * are granted by items, actions and events.
 */
const EFFECT_DEFS: EffectDefinition[] = [
  {
    id: "fx_rage",
    labelKey: "effect.rage",
    kind: "debuff",
    color: "red",
    icon: "💢",
    turns: 3,
    perTurn: { health: -3, angerValue: -2, happiness: -1 },
  },
  {
    id: "fx_mania",
    labelKey: "effect.mania",
    kind: "buff",
    color: "yellow",
    icon: "⚡",
    turns: 3,
    perTurn: { health: 1, weakValue: -2, happiness: 2 },
  },
  {
    id: "fx_gloom",
    labelKey: "effect.gloom",
    kind: "debuff",
    color: "blue",
    icon: "🌧",
    turns: 3,
    perTurn: { health: -1, weakValue: 1, happiness: -2 },
  },
  {
    id: "fx_fatigue",
    labelKey: "effect.fatigue",
    kind: "debuff",
    color: "white",
    icon: "🥱",
    turns: 3,
    perTurn: { health: -1, fitness: -1 },
  },
  {
    id: "fx_focus",
    labelKey: "effect.focus",
    kind: "buff",
    color: "cyan",
    icon: "🎯",
    turns: 3,
    perTurn: { intelligence: 1 },
  },
  {
    id: "fx_charm",
    labelKey: "effect.charm",
    kind: "buff",
    color: "magenta",
    icon: "✨",
    turns: 3,
    perTurn: { social: 1 },
  },
  {
    id: "fx_energy",
    labelKey: "effect.energy",
    kind: "buff",
    color: "green",
    icon: "🔥",
    turns: 3,
    perTurn: { fitness: 1, happiness: 1 },
  },
  {
    id: "fx_sick",
    labelKey: "effect.sick",
    kind: "debuff",
    color: "red",
    icon: "🤒",
    turns: 4,
    perTurn: { health: -3, happiness: -1 },
  },
  {
    id: "fx_inspired",
    labelKey: "effect.inspired",
    kind: "buff",
    color: "cyanBright",
    icon: "💡",
    turns: 3,
    perTurn: { happiness: 2, intelligence: 1 },
  },
  {
    id: "fx_blessed",
    labelKey: "effect.blessed",
    kind: "buff",
    color: "yellowBright",
    icon: "🍀",
    turns: 5,
    perTurn: { happiness: 2, health: 1 },
  },
  {
    id: "fx_wisdom",
    labelKey: "effect.wisdom",
    kind: "buff",
    color: "cyanBright",
    icon: "🦉",
    turns: 5,
    perTurn: { intelligence: 1, happiness: 1 },
  },
  {
    id: "fx_calm",
    labelKey: "effect.calm",
    kind: "buff",
    color: "blue",
    icon: "🕊",
    turns: 3,
    perTurn: { depressionValue: -3, angerValue: -3 },
  },
  {
    id: "fx_fortune",
    labelKey: "effect.fortune",
    kind: "buff",
    color: "yellow",
    icon: "🪙",
    turns: 3,
    perTurn: { money: 8 },
  },
  {
    id: "fx_heartache",
    labelKey: "effect.heartache",
    kind: "debuff",
    color: "magenta",
    icon: "💔",
    turns: 3,
    perTurn: { happiness: -2, health: -1 },
  },
  {
    id: "fx_lonely",
    labelKey: "effect.lonely",
    kind: "debuff",
    color: "blue",
    icon: "🌙",
    turns: 3,
    perTurn: { happiness: -2, depressionValue: 1 },
  },
  {
    id: "fx_famous",
    labelKey: "effect.famous",
    kind: "buff",
    color: "yellowBright",
    icon: "📣",
    turns: 4,
    perTurn: { reputation: 2, happiness: 1 },
  },
  {
    id: "fx_notorious",
    labelKey: "effect.notorious",
    kind: "debuff",
    color: "red",
    icon: "💢",
    turns: 4,
    perTurn: { reputation: -2, happiness: -1 },
  },
];

export default class Effects {
  private static init = false;

  public static load(): void {
    if (this.init) return;
    this.init = true;
    const reg = container.resolve(EffectRegistry);
    for (const def of EFFECT_DEFS) {
      if (!reg.has(def.id)) reg.register(def);
    }
  }
}
