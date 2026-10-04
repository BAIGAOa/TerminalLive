import { ChainDef } from "../world/chains/worldChainEngine.js";

/**
 * Builtin chains of world events. Fired by year, they cascade when conditions
 * hold — war breeds shortage, unrest and finally a coup; a plague reshapes
 * labour and prompts reform.
 */
export const WORLD_CHAINS: ChainDef[] = [
  {
    id: "chain_war",
    labelKey: "chain.war.title",
    triggerYear: 25,
    start: "war",
    nodes: {
      war: {
        id: "war",
        labelKey: "chain.war.war",
        bodyKey: "chain.war.war.body",
        delay: 0,
        effects: { pressures: { pr_order: -10, pr_unrest: 8 } },
        next: ["shortage"],
      },
      shortage: {
        id: "shortage",
        labelKey: "chain.war.shortage",
        bodyKey: "chain.war.shortage.body",
        delay: 3,
        effects: { pressures: { pr_scarcity: -12, pr_unrest: 6 }, marketBias: -0.05 },
        next: ["unrest"],
      },
      unrest: {
        id: "unrest",
        labelKey: "chain.war.unrest",
        bodyKey: "chain.war.unrest.body",
        delay: 3,
        requires: { minPressure: { axis: "pr_unrest", gte: 50 } },
        effects: { pressures: { pr_unrest: 10, pr_crime: 8 } },
        next: ["coup"],
      },
      coup: {
        id: "coup",
        labelKey: "chain.war.coup",
        bodyKey: "chain.war.coup.body",
        delay: 4,
        effects: {
          pressures: { pr_order: -20 },
          karma: { rebellion: 6 },
          flag: "world_coup",
        },
        next: ["newOrder"],
      },
      newOrder: {
        id: "newOrder",
        labelKey: "chain.war.newOrder",
        bodyKey: "chain.war.newOrder.body",
        delay: 2,
        effects: {
          pressures: { pr_order: 20, pr_unrest: -15 },
          karma: { benevolence: 3 },
          marketBias: 0.04,
          flag: "world_new_order",
        },
      },
    },
  },
  {
    id: "chain_plague",
    labelKey: "chain.plague.title",
    triggerYear: 45,
    start: "plague",
    nodes: {
      plague: {
        id: "plague",
        labelKey: "chain.plague.plague",
        bodyKey: "chain.plague.plague.body",
        delay: 0,
        effects: { pressures: { pr_vitality: -15, pr_plague: 10, pr_unrest: 5 } },
        next: ["labor"],
      },
      labor: {
        id: "labor",
        labelKey: "chain.plague.labor",
        bodyKey: "chain.plague.labor.body",
        delay: 2,
        effects: { marketBias: -0.03, pressures: { pr_scarcity: -6, pr_employment: -6 } },
        next: ["reform"],
      },
      reform: {
        id: "reform",
        labelKey: "chain.plague.reform",
        bodyKey: "chain.plague.reform.body",
        delay: 3,
        effects: {
          pressures: { pr_order: 5, pr_vitality: 8, pr_plague: -8 },
          flag: "world_public_health",
        },
      },
    },
  },
];

export function worldChainsById(): Record<string, ChainDef> {
  const out: Record<string, ChainDef> = {};
  for (const c of WORLD_CHAINS) out[c.id] = c;
  return out;
}
