/**
 * Prompts for inventing a person, and the rules for who it makes sense to meet.
 *
 * Pure prompt construction, like the mail system's `correspondence.ts`: no
 * container, no network. The model's answer is read back by
 * `parseGeneratedNpc`, which enforces the same limits again.
 */

import type { PlayerDossier } from "../playerDossier.js";
import type { ChatMessage } from "../careers/interview.js";
import { GENERATED_ROLES } from "./generated.js";

/**
 * The roles worth meeting at this age.
 *
 * This is the "different ages meet different people" rule: a toddler does not
 * befriend a colleague, and a retiree does not acquire a rival at the office.
 * The role windows in `NpcRoles` give the earliest age a role may appear; this
 * gives the band where it makes sense, which is what makes random encounters
 * feel like a life rather than a lottery.
 */
export function plausibleRoles(age: number): string[] {
  if (age < 6) return ["npc.role.family"];
  if (age < 13) {
    return ["npc.role.family", "npc.role.friend", "npc.role.mentor", "npc.role.pet"];
  }
  if (age < 18) {
    return [
      "npc.role.family",
      "npc.role.friend",
      "npc.role.rival",
      "npc.role.mentor",
      "npc.role.pet",
    ];
  }
  if (age < 60) {
    return [
      "npc.role.family",
      "npc.role.friend",
      "npc.role.partner",
      "npc.role.rival",
      "npc.role.mentor",
      "npc.role.work",
      "npc.role.pet",
    ];
  }
  return [
    "npc.role.family",
    "npc.role.friend",
    "npc.role.mentor",
    "npc.role.pet",
  ];
}

export interface NpcPromptContext {
  dossier: PlayerDossier;
  /** The tongue to write in, named in English for the model. */
  language: string;
  /** Roles that make sense this year; the model must pick one of these. */
  roles: string[];
  /** A one-line nudge about the kind of year the player is having. */
  mood: string;
}

export function npcSystemPrompt(): string {
  return [
    "You invent one person who is about to walk into someone's life in a life-simulation game.",
    "",
    "You are given their complete situation. Invent somebody who belongs in it — a neighbour, a colleague, a stranger on a bus, a relative nobody mentioned before.",
    "",
    "Rules:",
    "- Pick exactly one role from the list you are given. It decides how this person behaves, so an unsupported role means no character at all.",
    "- Give them a name that fits the world. Not a placeholder, not a pun, not the player's name.",
    "- The description is what the player learns on meeting them: one or two sentences, concrete, no adjectives doing the work of facts.",
    "- `temperament` is a short phrase, three or four words, the kind of thing someone would say about them behind their back.",
    "- Set the four trait axes between -1 and 1. Make somebody specific: a warm, unambitious, steady, sociable person is one option among many, not the default.",
    "- `opening` is the first thing they say to the player. One or two sentences, in character, spoken — not narrated.",
    "- Nothing here grants the player anything. You are creating a person, not an event.",
    `- Write the name, description, temperament and opening in the language the player reads.`,
    "",
    "Reply with ONLY a JSON object, no prose around it:",
    '{"name": "…", "roleKey": "npc.role.…", "description": "…", "temperament": "…", ' +
      '"traits": {"warmth": 0, "ambition": 0, "stability": 0, "sociability": 0}, "opening": "…"}',
  ].join("\n");
}

export function npcUserPrompt(ctx: NpcPromptContext): string {
  return [
    `Write in: ${ctx.language}`,
    "",
    "## Who they are about to meet (complete game state)",
    JSON.stringify(ctx.dossier, null, 2),
    "",
    "## How their year has gone",
    ctx.mood,
    "",
    "## The role must be exactly one of these",
    ctx.roles.join(", "),
    `(of which the game understands: ${GENERATED_ROLES.join(", ")})`,
    "",
    "Invent the person now.",
  ].join("\n");
}

export function npcMessages(ctx: NpcPromptContext): ChatMessage[] {
  return [
    { role: "system", content: npcSystemPrompt() },
    { role: "user", content: npcUserPrompt(ctx) },
  ];
}

// ── events ───────────────────────────────────────────────────────────

export function eventSystemPrompt(): string {
  return [
    "You invent one small thing that happens to somebody in a life-simulation game.",
    "",
    "You are given their complete situation. Invent something that could plausibly befall this specific person this year — not a plot twist, not a coincidence that changes everything. A letter arrives. A machine breaks. Somebody says the wrong thing at a family dinner.",
    "",
    "Rules:",
    "- The title is a few words, the way a newspaper would head it.",
    "- The body is one or two sentences describing what happened. Plain prose, past tense, no second person.",
    "- `effects` is what it does to them, in stats. Small numbers: a bad night is -3 health, a good week is +4 happiness. Anything above 10 in one stat is not a small thing.",
    "- You may only use these stats, and any you omit simply do not change:",
    "  health, intelligence, social, fitness, happiness, reputation, appearance, angerValue, excitationValue, depressionValue, weakValue",
    "- Never use age, height, weight or money. You cannot give or take money.",
    "- `weight` is how often this should happen, 0.05 to 0.6. Rare things are 0.1; things that happen most years are 0.5.",
    `- Write the title and body in the language the player reads.`,
    "",
    "Reply with ONLY a JSON object, no prose around it:",
    '{"title": "…", "body": "…", "effects": {"happiness": -3}, "weight": 0.3}',
  ].join("\n");
}

export function eventUserPrompt(ctx: Omit<NpcPromptContext, "roles">): string {
  return [
    `Write in: ${ctx.language}`,
    "",
    "## Who it happens to (complete game state)",
    JSON.stringify(ctx.dossier, null, 2),
    "",
    "## How their year has gone",
    ctx.mood,
    "",
    "Invent the event now.",
  ].join("\n");
}

export function eventMessages(ctx: Omit<NpcPromptContext, "roles">): ChatMessage[] {
  return [
    { role: "system", content: eventSystemPrompt() },
    { role: "user", content: eventUserPrompt(ctx) },
  ];
}
