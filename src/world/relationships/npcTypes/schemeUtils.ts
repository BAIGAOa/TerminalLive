import type { NpcPeer, NpcYearContext } from "../NpcScheme.js";

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
