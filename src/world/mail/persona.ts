/**
 * Who is writing, and how they sound.
 *
 * The whole point of this module is that two NPCs must never read like the
 * same person. Personality is derived, not authored: the four trait axes give
 * a *register*, and a stable hash of the NPC's id picks one of several quirks
 * inside that register — so two work colleagues with identical traits still
 * write differently, and the same NPC always writes like themselves.
 *
 * Pure and React-free: no container, no network.
 */

import type { NpcTraits } from "../relationships/NpcState.js";

/** Everything the prompt builder needs to keep a character in character. */
export interface Persona {
  npcId: string;
  /** i18n key of the NPC's name. */
  nameKey: string;
  roleKey?: string;
  /** How they talk, as an instruction to the model. */
  voice: string;
  /** What they want out of the player, in one line. */
  agenda: string;
  /** Sampling temperature — a rigid character reads cooler than a volatile one. */
  temperature: number;
  /** 0…1: how readily this one demands an answer instead of just writing. */
  decisive: number;
}

/** Stable 32-bit hash, so an NPC's quirk never changes between sessions. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function pick<T>(list: readonly T[], seed: number, salt: number): T {
  return list[(seed + salt * 0x9e3779b1) % list.length];
}

/** Register buckets: how warm, how driven, how steady, how talkative. */
const WARMTH = {
  cold: "You are cold and transactional; warmth is a currency you spend rarely.",
  cool: "You keep people at a professional distance.",
  neutral: "You are civil but not affectionate.",
  warm: "You are warm and openly care about the person you are writing to.",
  devoted: "You are devoted, almost uncomfortably so; you say the quiet part out loud.",
} as const;

const AMBITION = {
  idle: "You have no particular ambition and it shows in how you write.",
  steady: "You want a quiet, stable life and defend it.",
  driven: "You are driven; everything you write eventually comes back to advancement.",
  ruthless: "You are ruthless. You frame every favour as a debt to be repaid.",
} as const;

const STABILITY = {
  volatile: "Your mood swings are visible in the writing — short bursts, sudden turns.",
  steady: "You are even-tempered and measured.",
  rigid: "You are rigid and procedural; you dislike surprises.",
} as const;

const SOCIABILITY = {
  terse: "You write in short, clipped sentences and waste no words.",
  plain: "You write plainly and directly.",
  talkative: "You ramble a little, circling the point before making it.",
} as const;

/** The twist that keeps two identical trait profiles apart. */
const QUIRKS = [
  "You end by asking a question back, always.",
  "You use a metaphor drawn from your trade.",
  "You quote a proverb and then immediately undercut it.",
  "You bury the real request in the middle of the message.",
  "You apologise for writing, then write more rather than less.",
  "You keep score out loud — favours given, favours owed.",
  "You understate everything; real feelings arrive sideways.",
  "You address the reader by name more often than is comfortable.",
  "You mention the weather as if it were a serious matter.",
  "You never say what you want directly; you describe a situation and let it sit.",
  "You are formal to the point of absurdity in a short note.",
  "You open with a complaint, then soften completely.",
] as const;

function bucket(v: number, cuts: [number, number, number]): 0 | 1 | 2 | 3 {
  if (v < cuts[0]) return 0;
  if (v < cuts[1]) return 1;
  if (v < cuts[2]) return 2;
  return 3;
}

/** The trait-driven register, before the per-NPC quirk is applied. */
export function voiceFor(traits: NpcTraits, seed: number): string {
  const warmth = bucket(traits.warmth, [-0.2, 0.35, 0.7]);
  const ambition = bucket(traits.ambition, [0.25, 0.55, 0.8]);
  const stability = bucket(traits.stability, [0.4, 0.75, 1.1]);
  const sociability = bucket(traits.sociability, [0.35, 0.65, 0.85]);

  const parts = [
    warmth === 0
      ? WARMTH.cold
      : warmth === 1
        ? WARMTH.cool
        : warmth === 2
          ? WARMTH.warm
          : WARMTH.devoted,
    ambition === 0
      ? AMBITION.idle
      : ambition === 1
        ? AMBITION.steady
        : ambition === 2
          ? AMBITION.driven
          : AMBITION.ruthless,
    stability === 0
      ? STABILITY.volatile
      : stability === 1
        ? STABILITY.steady
        : STABILITY.rigid,
    sociability === 0
      ? SOCIABILITY.terse
      : sociability === 1
        ? SOCIABILITY.plain
        : SOCIABILITY.talkative,
    pick(QUIRKS, seed, 7),
  ];
  return parts.join(" ");
}

/** What this role wants from the player, in one line. */
export function agendaFor(roleKey: string | undefined, traits: NpcTraits): string {
  if (roleKey === "npc.role.work") return "You are their superior at work.";
  if (roleKey === "npc.role.rival") return "You want what they have.";
  if (roleKey === "npc.role.mentor") return "You are training them, whether they like it or not.";
  if (roleKey === "npc.role.family") return "You are family, with everything that entails.";
  if (roleKey === "npc.role.partner") return "You are their partner.";
  if (roleKey === "npc.role.friend") return "You are their friend.";
  if (roleKey === "npc.role.pet") return "You are their pet.";
  if (traits.ambition > 0.7) return "You want something from them and are not shy about it.";
  return "You know them socially.";
}

export interface PersonaInput {
  npcId: string;
  nameKey: string;
  roleKey?: string;
  traits: NpcTraits;
}

export function buildPersona(input: PersonaInput): Persona {
  const seed = hash(input.npcId);
  const { traits } = input;
  return {
    npcId: input.npcId,
    nameKey: input.nameKey,
    roleKey: input.roleKey,
    voice: voiceFor(traits, seed),
    agenda: agendaFor(input.roleKey, traits),
    // A volatile or cold character is allowed more rope than a steady one; this
    // is what makes two letters from the same roster read differently even
    // before the prompt text is considered.
    temperature:
      Math.round(
        (0.55 + (1 - traits.stability) * 0.3 + (seed % 100) / 1000) * 100,
      ) / 100,
    // Ruthless, driven NPCs push for an answer; quiet ones just write.
    decisive: Math.max(
      0,
      Math.min(1, 0.15 + traits.ambition * 0.5 + (1 - traits.warmth) * 0.25),
    ),
  };
}
