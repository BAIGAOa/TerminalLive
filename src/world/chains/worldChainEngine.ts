import { KarmaDelta } from "../chronicle/karma.js";

/**
 * Pure chain-of-events engine. Instead of one-shot world events, chains fire a
 * node, wait, then cascade into follow-ups when their conditions hold — e.g.
 * war → shortage → unrest → coup → new order. Effects are returned as data; the
 * `WorldChainSystem` applies them to the world/pressures/player.
 */

export interface ChainEffect {
  karma?: KarmaDelta;
  pressures?: Record<string, number>;
  standing?: Record<string, number>;
  flag?: string;
  /** Contribution to the market tilt while the node's aftermath lingers. */
  marketBias?: number;
}

export interface ChainRequirement {
  flags?: string[];
  minPressure?: { axis: string; gte: number };
  minStanding?: { faction: string; gte: number };
}

export interface ChainNodeDef {
  id: string;
  labelKey: string;
  bodyKey?: string;
  /** Years after the previous node before this one may fire. */
  delay: number;
  requires?: ChainRequirement;
  effects: ChainEffect;
  /** Node ids this one cascades into. */
  next?: string[];
}

export interface ChainDef {
  id: string;
  labelKey: string;
  /** World year at/after which the chain starts on its own. */
  triggerYear: number;
  start: string;
  nodes: Record<string, ChainNodeDef>;
}

export interface PendingNode {
  chainId: string;
  nodeId: string;
  dueYear: number;
}

export interface ChainState {
  /** Nodes scheduled but not yet fired. */
  active: PendingNode[];
  /** `${chainId}:${nodeId}` already fired this life. */
  fired: string[];
  /** Chain ids that have started. */
  started: string[];
  /** Lingering market tilt from fired nodes. */
  marketBias: number;
}

export interface ChainContext {
  year: number;
  flags: Set<string>;
  pressures: Record<string, number>;
  standing: Record<string, number>;
}

export interface ChainFireEvent {
  chainId: string;
  nodeId: string;
  labelKey: string;
  bodyKey?: string;
  effects: ChainEffect;
}

export function emptyChainState(): ChainState {
  return { active: [], fired: [], started: [], marketBias: 0 };
}

function key(chainId: string, nodeId: string): string {
  return `${chainId}:${nodeId}`;
}

export function requirementsMet(
  req: ChainRequirement | undefined,
  ctx: ChainContext,
): boolean {
  if (!req) return true;
  if (req.flags && !req.flags.every((f) => ctx.flags.has(f))) return false;
  if (req.minPressure) {
    const v = ctx.pressures[req.minPressure.axis] ?? 0;
    if (v < req.minPressure.gte) return false;
  }
  if (req.minStanding) {
    const v = ctx.standing[req.minStanding.faction] ?? 0;
    if (v < req.minStanding.gte) return false;
  }
  return true;
}

function schedule(state: ChainState, chainId: string, nodeId: string, year: number): void {
  if (state.fired.includes(key(chainId, nodeId))) return;
  if (state.active.some((p) => p.chainId === chainId && p.nodeId === nodeId)) return;
  state.active.push({ chainId, nodeId, dueYear: year });
}

/** Begin a chain at its start node in `year` (no-op if already started). */
export function startChain(state: ChainState, def: ChainDef, year: number): boolean {
  if (state.started.includes(def.id)) return false;
  state.started.push(def.id);
  schedule(state, def.id, def.start, year);
  return true;
}

/**
 * Advance chains one year: start any whose trigger year has arrived, then fire
 * every due node whose requirements are met, scheduling its successors.
 */
export function tickChains(
  state: ChainState,
  defs: Record<string, ChainDef>,
  ctx: ChainContext,
): ChainFireEvent[] {
  const events: ChainFireEvent[] = [];

  for (const def of Object.values(defs)) {
    if (!state.started.includes(def.id) && ctx.year >= def.triggerYear) {
      startChain(state, def, ctx.year);
    }
  }

  const remaining: PendingNode[] = [];
  // Successors are collected separately so a delay-0 node can't be fired in the
  // same tick we schedule it (we'd otherwise mutate `state.active` mid-iterate).
  const scheduled: PendingNode[] = [];
  // Dedup across everything already pending/queued so a converging (diamond)
  // chain can't queue the same node twice and double-fire it next tick.
  const queued = new Set(state.active.map((p) => key(p.chainId, p.nodeId)));
  for (const pending of [...state.active]) {
    const def = defs[pending.chainId];
    const node = def?.nodes[pending.nodeId];
    if (!def || !node) {
      // Content changed mid-life (mod reload / version skew): the pending node
      // is no longer resolvable. Drop it loudly rather than silently vanishing.
      console.warn(
        `[chain] 丢弃失效节点 ${pending.chainId}:${pending.nodeId}（内容已变更）`,
      );
      continue;
    }
    if (ctx.year < pending.dueYear) {
      remaining.push(pending);
      continue;
    }
    if (!requirementsMet(node.requires, ctx)) {
      // Hold the node until its conditions are met (never drop it silently).
      remaining.push(pending);
      continue;
    }
    state.fired.push(key(pending.chainId, pending.nodeId));
    events.push({
      chainId: pending.chainId,
      nodeId: pending.nodeId,
      labelKey: node.labelKey,
      bodyKey: node.bodyKey,
      effects: node.effects,
    });
    for (const nextId of node.next ?? []) {
      const nextDef = def.nodes[nextId];
      if (!nextDef) continue;
      const k = key(def.id, nextId);
      if (state.fired.includes(k) || queued.has(k)) continue;
      queued.add(k);
      scheduled.push({ chainId: def.id, nodeId: nextId, dueYear: ctx.year + nextDef.delay });
    }
  }
  state.active = [...remaining, ...scheduled];

  // The aftermath fades over time.
  state.marketBias = state.marketBias * 0.9;
  return events;
}

/** Apply a fired node's market tilt to the lingering bias (bounded). */
export function absorbMarketBias(state: ChainState, bias: number | undefined): void {
  if (!bias) return;
  state.marketBias = Math.max(-0.2, Math.min(0.2, state.marketBias + bias));
}
