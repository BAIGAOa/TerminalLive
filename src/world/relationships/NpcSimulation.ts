import { inject } from "../../Container.js";
import NpcRegistry from "./NpcRegistry.js";
import RandomService from "../../core/random/RandomService.js";
import WorldRuleEngine from "../rules/WorldRuleEngine.js";
import type { Npc } from "./Npc.js";
import { clamp, DEFAULT_TRAITS, goalsFor, stageOf } from "./NpcTraits.js";
import type {
  EdgeKind,
  NpcBond,
  NpcEdge,
  NpcLife,
  NpcSimEvent,
  NpcSimSnapshot,
  NpcTraits,
} from "./NpcState.js";
import type {
  NpcEdgeDelta,
  NpcLifeDelta,
  NpcPeer,
  NpcSchemeResult,
  NpcYearContext,
} from "./NpcScheme.js";

/**
 * The NPC life simulator: every NPC has a personality, a body of state
 * (age/stage/health/wealth/mood/career/partner) and social ties to other NPCs.
 * A yearly tick advances all of it under condition-driven rules — promotions,
 * illness and death keyed off the NPC's own state, friendships and rivalries
 * forming on the social graph — rather than pure dice. On top of that, each
 * NPC's archetype class contributes *schemes* (NPC↔NPC and NPC→player
 * behaviour), so the cast acts on itself and on the player. Emergent, and the
 * state is snapshotted into the save so mid-life resumes keep the same cast.
 */

/** The minimal player view a scheme needs (kept structural to avoid a DI cycle). */
export interface NpcPlayerRef {
  age: number;
  getRelationship(npcId: string): number;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export default class NpcSimulation {
  private registry: NpcRegistry;
  private random: RandomService;
  private rules: WorldRuleEngine;
  private lives = new Map<string, NpcLife>();
  private traits = new Map<string, NpcTraits>();
  private edges = new Map<string, NpcEdge>();
  private bonds = new Map<string, NpcBond>();

  constructor() {
    this.registry = inject(NpcRegistry);
    this.random = inject(RandomService);
    this.rules = inject(WorldRuleEngine);
  }

  // ── setup ──────────────────────────────────────────────────────
  public reset(): void {
    this.lives = new Map();
    this.traits = new Map();
    this.edges = new Map();
    this.bonds = new Map();

    const npcs = this.registry.getAll();
    for (const npc of npcs) {
      const age = npc.startAge ?? 30;
      const t = npc.traits();
      this.traits.set(npc.id, t);
      this.lives.set(npc.id, {
        age,
        stage: stageOf(age),
        alive: true,
        health: clamp(70 + t.stability * 20 + this.random.int(10), 20, 100),
        wealth: clamp(30 + t.ambition * 40 + this.random.int(20), 5, 100),
        mood: clamp(50 + t.warmth * 20 + this.random.int(15), 10, 100),
        careerTier: t.ambition > 0.6 ? 1 : 0,
        partnerId: null,
        children: 0,
        moved: false,
        homeRegion: null,
        goals: goalsFor(npc.roleKey, t),
        flags: [],
      });
      this.bonds.set(npc.id, { trust: 40, debt: 0, conflict: 0 });
    }
    this.seedGraph(npcs);
  }

  /** Seed ties from kinship + shared roles, so the cast already knows itself. */
  private seedGraph(npcs: Npc[]): void {
    for (const npc of npcs) {
      for (const kinId of npc.kinOf ?? []) {
        if (this.registry.has(kinId)) {
          this.setEdge(npc.id, kinId, { kind: "kin", affinity: 60, trust: 70 });
        }
      }
      if (npc.partnerOf && this.registry.has(npc.partnerOf)) {
        this.setEdge(npc.id, npc.partnerOf, { kind: "partner", affinity: 85, trust: 80 });
        const life = this.lives.get(npc.id);
        if (life) life.partnerId = npc.partnerOf;
      }
    }
    // Same-role peers gravitate: family = kin, friend = friend, work = colleague.
    for (let i = 0; i < npcs.length; i++) {
      for (let j = i + 1; j < npcs.length; j++) {
        const a = npcs[i];
        const b = npcs[j];
        if (a.roleKey !== b.roleKey) continue;
        if (this.edges.has(pairKey(a.id, b.id))) continue;
        const role = a.roleKey ?? "";
        let kind: EdgeKind | null = null;
        let affinity = 40;
        if (role === "npc.role.family") {
          kind = "kin";
          affinity = 55;
        } else if (role === "npc.role.friend") {
          kind = "friend";
          affinity = 60;
        } else if (role === "npc.role.work") {
          kind = "colleague";
          affinity = 25;
        }
        if (kind) this.setEdge(a.id, b.id, { kind, affinity, trust: 50 });
      }
    }
  }

  // ── lookups ────────────────────────────────────────────────────
  public get(npcId: string): NpcLife | undefined {
    return this.lives.get(npcId);
  }

  public getTraits(npcId: string): NpcTraits {
    return this.traits.get(npcId) ?? DEFAULT_TRAITS;
  }

  public bond(npcId: string): NpcBond {
    let b = this.bonds.get(npcId);
    if (!b) {
      b = { trust: 40, debt: 0, conflict: 0 };
      this.bonds.set(npcId, b);
    }
    return b;
  }

  /** Whether the player can still interact (alive and not moved away). */
  public isAvailable(npcId: string): boolean {
    const life = this.lives.get(npcId);
    if (!life) return true;
    return life.alive && !life.moved;
  }

  public statusKey(npcId: string): string {
    const life = this.lives.get(npcId);
    if (!life) return "npc.status.well";
    if (!life.alive) return "npc.status.deceased";
    if (life.moved) return "npc.status.moved";
    if (life.partnerId) return "npc.status.married";
    return "npc.status.well";
  }

  public stageKey(npcId: string): string {
    const life = this.lives.get(npcId);
    return `npc.stage.${life?.stage ?? "adult"}`;
  }

  public edge(a: string, b: string): NpcEdge | undefined {
    return this.edges.get(pairKey(a, b));
  }

  public neighbors(npcId: string): Array<{ npcId: string; edge: NpcEdge }> {
    const out: Array<{ npcId: string; edge: NpcEdge }> = [];
    for (const [key, edge] of this.edges) {
      const [x, y] = key.split("|");
      if (x === npcId) out.push({ npcId: y, edge });
      else if (y === npcId) out.push({ npcId: x, edge });
    }
    return out;
  }

  public adjustBond(npcId: string, delta: Partial<NpcBond>): void {
    const b = this.bond(npcId);
    b.trust = clamp(b.trust + (delta.trust ?? 0), 0, 100);
    b.debt = clamp(b.debt + (delta.debt ?? 0), -100, 100);
    b.conflict = clamp(b.conflict + (delta.conflict ?? 0), 0, 100);
  }

  private setEdge(a: string, b: string, edge: NpcEdge): void {
    this.edges.set(pairKey(a, b), edge);
  }

  private adjustEdge(a: string, b: string, d: { affinity?: number; trust?: number }): void {
    const key = pairKey(a, b);
    const edge = this.edges.get(key);
    if (!edge) return;
    edge.affinity = clamp(edge.affinity + (d.affinity ?? 0), -100, 100);
    edge.trust = clamp(edge.trust + (d.trust ?? 0), 0, 100);
  }

  private chance(p: number): boolean {
    return this.random.next() < p;
  }

  // ── the yearly tick ────────────────────────────────────────────
  public tickYear(player?: NpcPlayerRef): NpcSimEvent[] {
    const events: NpcSimEvent[] = [];
    for (const [npcId, life] of this.lives) {
      if (!life.alive) continue;
      const t = this.getTraits(npcId);
      this.ageOne(npcId, life, events);
      if (!life.alive) continue;
      this.driftStats(life, t);
      this.career(npcId, life, t, events);
      this.healthPass(npcId, life, t, events);
      this.lifeGoals(npcId, life, t, events);
    }
    this.socialPass(events);
    // The life events collected so far are what peers may *react* to.
    const lifeEvents = events.slice();
    this.schemePass(player, events);
    this.reactions(lifeEvents, player, events);
    this.playerCoupling(events);
    return events;
  }

  /** Age, stage transitions, and old-age mortality. */
  private ageOne(npcId: string, life: NpcLife, events: NpcSimEvent[]): void {
    life.age += 1;
    const before = life.stage;
    life.stage = stageOf(life.age);
    if (life.stage !== before && life.stage === "elder")
      life.health = clamp(life.health - 6, 0, 100);

    const ageHazard =
      life.age >= 85 ? 0.12 : life.age >= 72 ? 0.06 : life.age >= 60 ? 0.025 : 0.003;
    const frailty = life.health < 30 ? 2.5 : life.health < 50 ? 1.4 : 1;
    const hazard = ageHazard * frailty * this.rules.mortalityHazardMul();
    if (this.chance(hazard)) {
      life.alive = false;
      events.push({ npcId, kind: "died" });
    }
  }

  /** Personality-scaled drift of health / wealth / mood. */
  private driftStats(life: NpcLife, t: NpcTraits): void {
    const elder = life.stage === "elder" ? 1 : 0;
    life.health = clamp(life.health - 0.4 - elder * 1.2 + t.stability * 0.5, 0, 100);
    const careerPull = life.careerTier * 0.5;
    life.wealth = clamp(life.wealth + t.ambition * 0.8 + careerPull - 0.5, 0, 100);
    const attach = life.partnerId ? 0.6 : 0;
    life.mood = clamp(
      life.mood + t.warmth * 0.4 + attach + (life.health - 55) / 60 - (life.moved ? 0.8 : 0),
      0,
      100,
    );
  }

  /** Career climbing is gated by mood/wealth and driven by ambition. */
  private career(npcId: string, life: NpcLife, t: NpcTraits, events: NpcSimEvent[]): void {
    if (life.stage !== "adult" && life.stage !== "youth") return;
    if (life.careerTier >= 4) return;
    const ready = life.mood > 35 && life.wealth > life.careerTier * 18;
    if (ready && this.chance(0.05 + t.ambition * 0.12)) {
      life.careerTier += 1;
      life.wealth = clamp(life.wealth + 6, 0, 100);
      life.mood = clamp(life.mood + 3, 0, 100);
      events.push({ npcId, kind: "promote" });
    }
  }

  /** Illness, recovery, and the rare windfall/ruin from wealth swings. */
  private healthPass(npcId: string, life: NpcLife, t: NpcTraits, events: NpcSimEvent[]): void {
    const frail = life.stage === "elder" ? 1.3 : 1;
    const illnessP = (life.health < 45 ? 0.12 : 0.03) * frail * (1.4 - t.stability);
    if (this.chance(illnessP)) {
      life.health = clamp(life.health - (8 + this.random.int(12)), 0, 100);
      life.mood = clamp(life.mood - 4, 0, 100);
      events.push({ npcId, kind: "illness" });
    } else if (life.health < 60 && this.chance(0.12 + t.stability * 0.1)) {
      life.health = clamp(life.health + (6 + this.random.int(10)), 0, 100);
      events.push({ npcId, kind: "recovered" });
    }

    if (life.wealth > 85 && this.chance(0.05)) {
      life.wealth = clamp(life.wealth + 10, 0, 100);
      events.push({ npcId, kind: "windfall" });
    } else if (life.wealth < 12 && this.chance(0.08)) {
      life.wealth = clamp(life.wealth - 6, 0, 100);
      life.mood = clamp(life.mood - 5, 0, 100);
      events.push({ npcId, kind: "ruin" });
    }
  }

  /** Love, family and migration — the goals each NPC is chasing. */
  private lifeGoals(npcId: string, life: NpcLife, t: NpcTraits, events: NpcSimEvent[]): void {
    // Moving away / returning, driven by ambition (opportunity) and restlessness.
    if (!life.moved && life.stage === "adult" && this.chance(0.015 * (0.5 + t.ambition))) {
      life.moved = true;
      events.push({ npcId, kind: "moved" });
    } else if (life.moved && this.chance(0.05)) {
      life.moved = false;
      events.push({ npcId, kind: "returned" });
    }

    // Families grow only once partnered.
    if (
      life.partnerId &&
      life.stage !== "elder" &&
      life.children < 4 &&
      life.mood > 45 &&
      this.chance(0.09)
    ) {
      life.children += 1;
      events.push({ npcId, kind: "child" });
    }
  }

  /** Ties strengthen or fray; new friendships and rivalries form; pairs form. */
  private socialPass(events: NpcSimEvent[]): void {
    const ids = [...this.lives.keys()].filter((id) => this.lives.get(id)?.alive);
    if (ids.length < 2) return;

    // Drift a few existing ties.
    const edgeKeys = [...this.edges.keys()];
    for (let n = 0; n < Math.min(3, edgeKeys.length); n++) {
      const [a, b] = edgeKeys[this.random.int(edgeKeys.length)].split("|");
      const la = this.lives.get(a);
      const lb = this.lives.get(b);
      if (!la?.alive || !lb?.alive) continue;
      const ta = this.getTraits(a);
      const tb = this.getTraits(b);
      const compat = ta.warmth + tb.warmth - (ta.ambition + tb.ambition) * 0.4;
      if (compat > 0.2) {
        this.adjustEdge(a, b, { affinity: 3, trust: 3 });
        la.mood = clamp(la.mood + 1, 0, 100);
        lb.mood = clamp(lb.mood + 1, 0, 100);
      } else if (compat < -0.2) {
        this.adjustEdge(a, b, { affinity: -4, trust: -4 });
      }
    }

    // Form a new tie occasionally.
    if (ids.length >= 2 && this.chance(0.25)) {
      const a = ids[this.random.int(ids.length)];
      const b = ids[this.random.int(ids.length)];
      if (a !== b && !this.edges.has(pairKey(a, b))) {
        const warm = this.getTraits(a).warmth + this.getTraits(b).warmth;
        const kind: EdgeKind = warm >= 0 ? "friend" : "rival";
        this.setEdge(a, b, {
          kind,
          affinity: warm >= 0 ? 45 : -40,
          trust: warm >= 0 ? 45 : 20,
        });
        events.push({ npcId: a, kind: warm >= 0 ? "friendMade" : "rivalMade", otherId: b });
      }
    }

    // Partnership: two single adults with a strong warm tie pair up.
    for (const [key, edge] of this.edges) {
      if (edge.kind === "partner" || edge.trust < 70 || edge.affinity < 60) continue;
      const [a, b] = key.split("|");
      const la = this.lives.get(a);
      const lb = this.lives.get(b);
      if (!la?.alive || !lb?.alive) continue;
      if (la.partnerId || lb.partnerId) continue;
      if (la.stage === "child" || lb.stage === "child") continue;
      if (!this.chance(0.12)) continue;
      la.partnerId = b;
      lb.partnerId = a;
      edge.kind = "partner";
      edge.affinity = clamp(edge.affinity + 20, -100, 100);
      la.mood = clamp(la.mood + 8, 0, 100);
      lb.mood = clamp(lb.mood + 8, 0, 100);
      events.push({ npcId: a, kind: "married", otherId: b });
    }
  }

  // ── behaviour: NPC↔NPC / NPC→player schemes ───────────────────
  /** A read-only world view handed to each archetype's scheme hooks. */
  private makeContext(player: NpcPlayerRef | undefined): NpcYearContext {
    const playerAge = player?.age ?? 0;
    const peers: NpcPeer[] = [];
    for (const [id, life] of this.lives) {
      if (!life.alive) continue;
      const npc = this.registry.get(id);
      if (npc) peers.push({ npc, life });
    }
    return {
      random: this.random,
      playerAge,
      peers,
      life: (id) => this.lives.get(id),
      edge: (a, b) => this.edges.get(pairKey(a, b)),
      bond: (id) => this.bond(id),
      playerAffinity: (id) => player?.getRelationship(id) ?? 0,
      knowsPlayer: (id) => this.registry.get(id)?.knowsAt(playerAge) ?? false,
    };
  }

  /** Every living archetype gets a chance to scheme against a peer/player. */
  private schemePass(player: NpcPlayerRef | undefined, out: NpcSimEvent[]): void {
    const ctx = this.makeContext(player);
    for (const [id, life] of this.lives) {
      if (!life.alive) continue;
      const npc = this.registry.get(id);
      if (!npc) continue;
      // The active world's rules scale how often this archetype schemes.
      const factor = this.rules.npcSchemeFactor(
        npc.roleKey,
        new Set([npc.roleKey ?? ""]),
      );
      if (factor <= 0) continue;
      if (factor < 1 && this.random.next() >= factor) continue;
      const runs = factor > 1 ? Math.min(3, Math.round(factor)) : 1;
      for (let k = 0; k < runs; k++) {
        for (const result of npc.peerScheme(ctx)) {
          this.applyScheme(result);
          out.push(this.toSchemeEvent(result));
        }
      }
    }
  }

  /** Peers react to the year's life events (consolation, envy, care…). */
  private reactions(
    causes: NpcSimEvent[],
    player: NpcPlayerRef | undefined,
    out: NpcSimEvent[],
  ): void {
    if (causes.length === 0) return;
    const ctx = this.makeContext(player);
    for (const cause of causes) {
      if (cause.kind === "scheme" || cause.kind === "died") continue;
      for (const { npcId } of this.neighbors(cause.npcId)) {
        const npc = this.registry.get(npcId);
        if (!npc) continue;
        const result = npc.reactToPeer(cause, ctx);
        if (!result) continue;
        this.applyScheme(result);
        out.push(this.toSchemeEvent(result));
      }
    }
  }

  private toSchemeEvent(r: NpcSchemeResult): NpcSimEvent {
    return {
      npcId: r.actorId,
      kind: "scheme",
      otherId: r.targetId,
      logKey: r.logKey,
      toastKey: r.player?.toastKey,
      player: r.player,
    };
  }

  private applyScheme(r: NpcSchemeResult): void {
    const actor = this.lives.get(r.actorId);
    if (actor) this.applyLifeDelta(actor, r.actor);
    if (r.targetId) {
      const target = this.lives.get(r.targetId);
      if (target) this.applyLifeDelta(target, r.target);
      if (r.edge) this.applyEdgeDelta(r.actorId, r.targetId, r.edge);
    }
  }

  private applyLifeDelta(life: NpcLife, d: NpcLifeDelta | undefined): void {
    if (!d) return;
    if (d.health !== undefined) life.health = clamp(life.health + d.health, 0, 100);
    if (d.wealth !== undefined) life.wealth = clamp(life.wealth + d.wealth, 0, 100);
    if (d.mood !== undefined) life.mood = clamp(life.mood + d.mood, 0, 100);
    if (d.careerTier !== undefined) life.careerTier = clamp(life.careerTier + d.careerTier, 0, 4);
    if (d.children !== undefined) life.children = Math.max(0, life.children + d.children);
    if (d.alive !== undefined) life.alive = d.alive;
    if (d.moved !== undefined) life.moved = d.moved;
    if (d.partnerId !== undefined) life.partnerId = d.partnerId;
    if (d.flags) {
      for (const f of d.flags) if (!life.flags.includes(f)) life.flags.push(f);
    }
  }

  private applyEdgeDelta(a: string, b: string, d: NpcEdgeDelta): void {
    const edge = this.edges.get(pairKey(a, b));
    if (!edge) return;
    if (d.kind) edge.kind = d.kind;
    if (d.affinity !== undefined) edge.affinity = clamp(edge.affinity + d.affinity, -100, 100);
    if (d.trust !== undefined) edge.trust = clamp(edge.trust + d.trust, 0, 100);
  }

  /**
   * Fold NPC life events into the player's bonds for NPCs the player knows:
   * a friend's good news warms trust, a rival's rise breeds conflict, and
   * hardship draws on the relationship.
   */
  private playerCoupling(events: NpcSimEvent[]): void {
    for (const ev of events) {
      if (ev.kind === "scheme") continue; // schemes carry their own bond deltas
      const b = this.bonds.get(ev.npcId);
      if (!b) continue;
      switch (ev.kind) {
        case "promote":
        case "windfall":
        case "married":
        case "child":
          b.trust = clamp(b.trust + 2, 0, 100);
          break;
        case "illness":
        case "ruin":
        case "died":
          b.conflict = clamp(b.conflict + 2, 0, 100);
          break;
        case "rivalMade":
          b.conflict = clamp(b.conflict + 4, 0, 100);
          b.trust = clamp(b.trust - 3, 0, 100);
          break;
        case "friendMade":
          b.trust = clamp(b.trust + 2, 0, 100);
          break;
        default:
          break;
      }
    }
  }

  // ── persistence ────────────────────────────────────────────────
  public snapshot(): NpcSimSnapshot {
    const lives: NpcSimSnapshot["lives"] = {};
    for (const [id, l] of this.lives)
      lives[id] = { ...l, goals: [...l.goals], flags: [...l.flags] };
    const edges: Record<string, NpcEdge> = {};
    for (const [k, e] of this.edges) edges[k] = { ...e };
    const bonds: Record<string, NpcBond> = {};
    for (const [id, b] of this.bonds) bonds[id] = { ...b };
    return { lives, edges, bonds };
  }

  public restore(snap: Partial<NpcSimSnapshot> | undefined): void {
    if (!snap) return;
    // Each present field is authoritative: clear before repopulating so a life
    // loaded onto an already-populated singleton can't keep stale NPCs/edges.
    if (snap.lives) {
      this.lives.clear();
      for (const [id, l] of Object.entries(snap.lives)) {
        this.lives.set(id, {
          ...l,
          goals: [...(l.goals ?? [])] as NpcLife["goals"],
          flags: [...(l.flags ?? [])],
        });
        if (!this.traits.has(id)) {
          this.traits.set(id, this.registry.get(id)?.traits() ?? DEFAULT_TRAITS);
        }
      }
    }
    if (snap.edges) {
      this.edges.clear();
      for (const [k, e] of Object.entries(snap.edges)) this.edges.set(k, { ...e });
    }
    if (snap.bonds) {
      this.bonds.clear();
      for (const [id, b] of Object.entries(snap.bonds)) this.bonds.set(id, { ...b });
    }
  }
}

export type {
  EdgeKind,
  NpcBond,
  NpcEdge,
  NpcEventKind,
  NpcGoal,
  NpcLife,
  NpcSimEvent,
  NpcSimSnapshot,
  NpcStage,
  NpcTraits,
} from "./NpcState.js";
export { DEFAULT_TRAITS, ROLE_TRAITS, goalsFor, stageOf } from "./NpcTraits.js";
