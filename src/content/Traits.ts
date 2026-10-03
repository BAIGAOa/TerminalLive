import { container } from "../Container.js";
import TraitRegistry from "../world/traits/TraitRegistry.js";
import { TraitDefinition } from "../world/traits/TraitDefinition.js";

/** Starting traits; the player may pick up to two before a life begins. */
const TRAIT_DEFS: TraitDefinition[] = [
  {
    id: "trait_smart",
    labelKey: "trait.smart",
    descKey: "trait.smart.desc",
    icon: "🧠",
    start: { intelligence: 15 },
  },
  {
    id: "trait_strong",
    labelKey: "trait.strong",
    descKey: "trait.strong.desc",
    icon: "💪",
    start: { fitness: 15, health: 5 },
  },
  {
    id: "trait_charming",
    labelKey: "trait.charming",
    descKey: "trait.charming.desc",
    icon: "😊",
    start: { social: 15 },
  },
  {
    id: "trait_rich",
    labelKey: "trait.rich",
    descKey: "trait.rich.desc",
    icon: "💰",
    start: { money: 300 },
  },
  {
    id: "trait_lucky",
    labelKey: "trait.lucky",
    descKey: "trait.lucky.desc",
    icon: "🍀",
    buff: { id: "fx_blessed", turns: 8 },
  },
  {
    id: "trait_healthy",
    labelKey: "trait.healthy",
    descKey: "trait.healthy.desc",
    icon: "❤️",
    start: { health: 15 },
  },
  {
    id: "trait_optimist",
    labelKey: "trait.optimist",
    descKey: "trait.optimist.desc",
    icon: "🌞",
    start: { happiness: 15 },
  },
  {
    id: "trait_diligent",
    labelKey: "trait.diligent",
    descKey: "trait.diligent.desc",
    icon: "📚",
    start: { intelligence: 8, fitness: 5 },
  },
  {
    id: "trait_sensitive",
    labelKey: "trait.sensitive",
    descKey: "trait.sensitive.desc",
    icon: "🎨",
    start: { intelligence: 12, happiness: -5 },
  },
  {
    id: "trait_stubborn",
    labelKey: "trait.stubborn",
    descKey: "trait.stubborn.desc",
    icon: "🧱",
    start: { fitness: 8, health: 8, social: -5 },
  },
];

export default class Traits {
  private static init = false;

  public static load(): void {
    if (this.init) return;
    this.init = true;
    const reg = container.resolve(TraitRegistry);
    for (const def of TRAIT_DEFS) {
      if (!reg.has(def.id)) reg.register(def);
    }
  }
}
