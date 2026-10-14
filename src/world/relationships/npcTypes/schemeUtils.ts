import type { NpcRegion } from "../../regions/npcRegion.js";
import type { NpcPeer, NpcYearContext } from "../NpcScheme.js";

/**
 * The region an NPC lives in, or `undefined`.
 *
 * Always `undefined` when the context was built without a region view, and when
 * the id is not a region this world has — so a scheme must treat it as "no
 * region" rather than assuming one. That is what keeps every region-aware branch
 * inert in the tests and in saves that predate regions.
 */
export function homeOf(ctx: NpcYearContext, npcId: string): NpcRegion | undefined {
  return ctx.region?.(ctx.homeRegion?.(npcId) ?? null);
}

/** All living peers other than the actor. */
export function alivePeers(ctx: NpcYearContext, actorId: string): NpcPeer[] {
  return ctx.peers.filter((p) => p.npc.id !== actorId && p.life.alive);
}

/** Living peers the actor has an edge to. */
export function neighbors(ctx: NpcYearContext, actorId: string): NpcPeer[] {
  return alivePeers(ctx, actorId).filter((p) => ctx.edge(actorId, p.npc.id));
}

/** A uniform pick, or undefined on an empty list. */
export function pick<T>(ctx: NpcYearContext, arr: T[]): T | undefined {
  return arr.length === 0 ? undefined : arr[ctx.random.int(arr.length)];
}

/** A probability roll on the shared stream. */
export function chance(ctx: NpcYearContext, p: number): boolean {
  return ctx.random.next() < p;
}
