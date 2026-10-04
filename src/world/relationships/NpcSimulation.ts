import { inject } from "../../Container.js";
import NpcRegistry from "./NpcRegistry.js";
import RandomService from "../../core/random/RandomService.js";
import { NpcDefinition } from "./NpcDefinition.js";

/**
 * The NPC life simulator: every NPC has a personality, a body of state
 * (age/stage/health/wealth/mood/career/partner) and social ties to other NPCs.
 * A yearly tick advances all of it under condition-driven rules — promotions,
 * illness and death keyed off the NPC's own state, friendships and rivalries
 * forming on the social graph — rather than pure dice. Emergent, and the state
 * is snapshotted into the save so mid-life resumes keep the same cast.
 */

export type NpcStage = "child" | "youth" | "adult" | "elder";
export type NpcGoal = "love" | "career" | "wealth" | "health" | "family";
export type EdgeKind = "kin" | "friend" | "rival" | "partner" | "colleague";

export type NpcEventKind =
  | "married"
  | "child"
  | "promote"
  | "illness"
  | "recovered"
  | "moved"
  | "returned"
  | "died"
  | "friendMade"
  | "rivalMade"
  | "windfall"
  | "ruin";

export interface NpcSimEvent {
  npcId: string;
  kind: NpcEventKind;
  /** A tie change may carry the other party. */
  otherId?: string;
}

/** Personality axes in [-1, 1]. Derived from role unless the def overrides. */
export interface NpcTraits {
  warmth: number;
  ambition: number;
  stability: number;
  sociability: number;
}

export interface NpcLife {
  age: number;
  stage: NpcStage;
  alive: boolean;
  health: number; // 0..100
  wealth: number; // 0..100
  mood: number; // 0..100
  careerTier: number; // 0..4
  partnerId: string | null;
  children: number;
  moved: boolean;
  homeRegion: string | null;
  goals: NpcGoal[];
}

export interface NpcEdge {
  kind: EdgeKind;
  affinity: number; // -100..100
  trust: number; // 0..100
}

/** Multi-axis player↔NPC bond, alongside the scalar affinity on the player. */
export interface NpcBond {
  trust: number; // 0..100
  /** Owed/owing — positive means the player is in the NPC's debt. */
  debt: number; // -100..100
  conflict: number; // 0..100
}

/** Serializable form used for save/restore (goals as plain strings). */
export interface NpcSimSnapshot {
  lives: Record<string, Omit<NpcLife, "goals"> & { goals: string[] }>;
  edges: Record<string, NpcEdge>;
  bonds: Record<string, NpcBond>;
}

const ROLE_TRAITS: Record<string, NpcTraits> = {
  "npc.role.family": { warmth: 0.8, ambition: 0.2, stability: 0.75, sociability: 0.5 },
  "npc.role.friend": { warmth: 0.7, ambition: 0.35, stability: 0.5, sociability: 0.85 },
  "npc.role.mentor": { warmth: 0.6, ambition: 0.5, stability: 0.85, sociability: 0.4 },
  "npc.role.partner": { warmth: 0.9, ambition: 0.35, stability: 0.6, sociability: 0.6 },
  "npc.role.work": { warmth: 0.25, ambition: 0.8, stability: 0.6, sociability: 0.5 },
  "npc.role.rival": { warmth: -0.4, ambition: 0.9, stability: 0.4, sociability: 0.4 },
  "npc.role.pet": { warmth: 0.9, ambition: 0.0, stability: 0.5, sociability: 0.7 },
};

const DEFAULT_TRAITS: NpcTraits = {
  warmth: 0.3,
  ambition: 0.4,
  stability: 0.6,
  sociability: 0.5,
};

export function stageOf(age: number): NpcStage {
  if (age < 14) return "child";
  if (age < 30) return "youth";
  if (age < 65) return "adult";
  return "elder";
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Goals an NPC pursues, from role + personality. Goals bias the yearly
 * simulation (an ambitious NPC chases career; a warm one chases love/family).
 */
function goalsFor(role: string | undefined, traits: NpcTraits): NpcGoal[] {
  const goals: NpcGoal[] = [];
  if (traits.ambition > 0.5) goals.push("career", "wealth");
  if (traits.warmth > 0.5) goals.push("love", "family");
  if (role === "npc.role.rival") goals.push("career", "wealth");
  if (goals.length === 0) goals.push("health");
  return Array.from(new Set(goals));
}

export default class NpcSimulation {
  private registry: NpcRegistry;
  private random: RandomService;
  private lives = new Map<string, NpcLife>();
  private traits = new Map<string, NpcTraits>();
  private edges = new Map<string, NpcEdge>();
  private bonds = new Map<string, NpcBond>();

  constructor() {
    this.registry = inject(NpcRegistry);
    this.random = inject(RandomService);
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
      const t = ROLE_TRAITS[npc.roleKey ?? ""] ?? DEFAULT_TRAITS;
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
      });
      this.bonds.set(npc.id, { trust: 40, debt: 0, conflict: 0 });
    }
    this.seedGraph(npcs);
  }

  /** Seed ties from kinship + shared roles, so the cast already knows itself. */
  private seedGraph(npcs: NpcDefinition[]): void {
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
  public tickYear(): NpcSimEvent[] {
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
    this.playerCoupling(events);
    return events;
  }

  /** Age, stage transitions, and old-age mortality. */
  private ageOne(npcId: string, life: NpcLife, events: NpcSimEvent[]): void {
    life.age += 1;
    const before = life.stage;
    life.stage = stageOf(life.age);
    if (life.stage !== before && life.stage === "elder") life.health -= 6;

    const ageHazard =
      life.age >= 85 ? 0.12 : life.age >= 72 ? 0.06 : life.age >= 60 ? 0.025 : 0.003;
    const frailty = life.health < 30 ? 2.5 : life.health < 50 ? 1.4 : 1;
    if (this.chance(ageHazard * frailty)) {
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

  /**
   * Fold NPC life events into the player's bonds for NPCs the player knows:
   * a friend's good news warms trust, a rival's rise breeds conflict, and
   * hardship draws on the relationship.
   */
  private playerCoupling(events: NpcSimEvent[]): void {
    for (const ev of events) {
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
    for (const [id, l] of this.lives) lives[id] = { ...l, goals: [...l.goals] };
    const edges: Record<string, NpcEdge> = {};
    for (const [k, e] of this.edges) edges[k] = { ...e };
    const bonds: Record<string, NpcBond> = {};
    for (const [id, b] of this.bonds) bonds[id] = { ...b };
    return { lives, edges, bonds };
  }

  public restore(snap: Partial<NpcSimSnapshot> | undefined): void {
    if (!snap) return;
    if (snap.lives) {
      for (const [id, l] of Object.entries(snap.lives)) {
        this.lives.set(id, {
          ...l,
          goals: [...(l.goals ?? [])] as NpcGoal[],
        });
        if (!this.traits.has(id)) {
          const npc = this.registry.get(id);
          this.traits.set(id, ROLE_TRAITS[npc?.roleKey ?? ""] ?? DEFAULT_TRAITS);
        }
      }
    }
    if (snap.edges) {
      for (const [k, e] of Object.entries(snap.edges)) this.edges.set(k, { ...e });
    }
    if (snap.bonds) {
      for (const [id, b] of Object.entries(snap.bonds)) this.bonds.set(id, { ...b });
    }
  }
}
