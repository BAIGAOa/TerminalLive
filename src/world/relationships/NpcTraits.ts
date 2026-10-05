import type { NpcGoal, NpcStage, NpcTraits } from "./NpcState.js";

/**
 * Role/type personality defaults and the pure helpers derived from them.
 * Extracted from {@link NpcSimulation} so the base {@link Npc} class can own
 * its own `traits()` without importing the simulator (which imports the class).
 */

export const ROLE_TRAITS: Record<string, NpcTraits> = {
  "npc.role.family": { warmth: 0.8, ambition: 0.2, stability: 0.75, sociability: 0.5 },
  "npc.role.friend": { warmth: 0.7, ambition: 0.35, stability: 0.5, sociability: 0.85 },
  "npc.role.mentor": { warmth: 0.6, ambition: 0.5, stability: 0.85, sociability: 0.4 },
  "npc.role.partner": { warmth: 0.9, ambition: 0.35, stability: 0.6, sociability: 0.6 },
  "npc.role.work": { warmth: 0.25, ambition: 0.8, stability: 0.6, sociability: 0.5 },
  "npc.role.rival": { warmth: -0.4, ambition: 0.9, stability: 0.4, sociability: 0.4 },
  "npc.role.pet": { warmth: 0.9, ambition: 0.0, stability: 0.5, sociability: 0.7 },
};

export const DEFAULT_TRAITS: NpcTraits = {
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

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Goals an NPC pursues, from role + personality. Goals bias the yearly
 * simulation (an ambitious NPC chases career; a warm one chases love/family).
 */
export function goalsFor(role: string | undefined, traits: NpcTraits): NpcGoal[] {
  const goals: NpcGoal[] = [];
  if (traits.ambition > 0.5) goals.push("career", "wealth");
  if (traits.warmth > 0.5) goals.push("love", "family");
  if (role === "npc.role.rival") goals.push("career", "wealth");
  if (goals.length === 0) goals.push("health");
  return Array.from(new Set(goals));
}
