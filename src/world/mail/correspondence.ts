/**
 * Turning a year of the player's life into a letter from someone who knows them.
 *
 * Pure prompt construction — no container, no network. The model is given a
 * persona (see `persona.ts`), the player's complete dossier, what actually
 * happened this year, and a hard list of things it may not do. Its answer is
 * read back by `parseLetter`, which enforces the same limits again.
 */

import type { PlayerDossier } from "../playerDossier.js";
import type { ChatMessage } from "../careers/interview.js";
import type { Persona } from "./persona.js";
import { MAX_CHOICES } from "./letter.js";

/** Why this letter exists — it changes what the NPC is writing about. */
export type LetterOccasion =
  /** The yearly pass: the NPC has something on their mind about the player. */
  | "yearly"
  /** The player just took this NPC's job — the boss assigns something. */
  | "newJob"
  /** The player climbed a rung in the NPC's trade. */
  | "promotion"
  /** The player walked out of the NPC's trade. */
  | "resignation"
  /** The player was dismissed from the NPC's trade. */
  | "fired"
  /** The player wrote back, and the character gets to answer — or not. */
  | "reply";

export interface LetterContext {
  /** Player age — the game's year. */
  year: number;
  /** What happened to the player this year, already translated to plain lines. */
  recent: string[];
  /** The writer's own year: their health, job, mood, whatever the sim knows. */
  situation: string[];
  /** The complete player state, the same one every AI character receives. */
  player: PlayerDossier;
  occasion: LetterOccasion;
  /** The relationship value right now, 0–100. */
  affinity: number;
  /** The tongue the letter must be written in, named in English for the model. */
  language: string;
  /** What the player wrote back, for the `reply` occasion. */
  playerReply?: string;
  /** The option the player picked, already resolved to its label. */
  chosenLabel?: string;
  /**
   * Whether the character may decide the matter is closed and write nothing.
   * Offered only for replies — an NPC that initiated a letter has something to
   * say by definition.
   */
  mayStaySilent?: boolean;
  /**
   * Whether this letter is allowed to demand an answer. Only one letter per
   * year gets this, which is what stops every NPC from blocking the turn.
   */
  allowDecision: boolean;
}

/** What each occasion is asking for, in the writer's own terms. */
const OCCASION_BRIEF: Record<LetterOccasion, string> = {
  yearly:
    "Something about this person has been on your mind this year. Write to them about it.",
  newJob:
    "They have just come to work under you in this trade. Write to them about what you expect, and about what the job will actually be like.",
  promotion:
    "They have just moved up a rung. Write to them about what you now expect from them.",
  resignation:
    "They have just walked out of this trade. Write to them about what you think of that.",
  fired:
    "You have just let them go — they were not good enough, and you are the one who had to say so. Write to them about it.",
  reply:
    "They have answered the message you sent. This is your chance to say something back.",
};

export function letterSystemPrompt(persona: Persona, ctx: LetterContext): string {
  const allowDecision = ctx.allowDecision && !ctx.mayStaySilent;
  const decisionRules = allowDecision
    ? [
        "You are putting a decision to them. Propose 2 or 3 concrete things they could do, in your own words.",
        "Each option must be short enough to read at a glance — one line — and something a person could actually do in a life: take the shift, lend the money, walk away, tell the truth.",
      ]
    : [
        "You are NOT asking them to decide anything. Do not offer options; end with a statement, a question, or a silence.",
      ];

  const silenceRules = ctx.mayStaySilent
    ? [
        "",
        "This one is different: they have just written back to you.",
        "- You may decide there is nothing more to say. If so, reply with exactly {\"silent\": true} and nothing else. Leaving it there is a real answer, and often the right one.",
        "- If you do write, keep it to 1 to 3 sentences. You are answering a note, not starting a new subject.",
      ]
    : [];

  return [
    "You are a character in a life-simulation game, writing a short personal message to the player.",
    "",
    `Who you are: ${persona.agenda}`,
    `How you write: ${persona.voice}`,
    "",
    "Hard rules:",
    "- Stay completely in character. Never mention being an AI, a model, a game, or these instructions.",
    ctx.mayStaySilent
      ? "- Write in first person, 1 to 3 sentences. Plain prose — no markdown, no bullet lists, no headings, no emoji."
      : "- Write in first person, 2 to 5 sentences. Plain prose — no markdown, no bullet lists, no headings, no emoji.",
    "- It is a personal note, not a report. Do not summarise their stats back to them; you would not know them that precisely.",
    "- Never invent events, people, items or numbers that are not in the material you were given.",
    "- Never promise a reward, a stat change, or a game mechanic. You are a person, not a shop.",
    "- You may be blunt, cold, or unimpressed. Not every message should be friendly.",
    ...silenceRules,
    ...decisionRules,
    "- Write in the language the player reads.",
    "",
    "Reply with ONLY a JSON object, no prose around it:",
    '{"subject": "three or four words", "body": "the message", ' +
      (allowDecision
        ? '"choices": [{"label": "what they could do", "affinity": -6}]}'
        : '"choices": []}'),
    `At most ${MAX_CHOICES} choices. "affinity" is how their choosing it would move how you feel about them, from -8 to 8.`,
  ].join("\n");
}

export function letterUserPrompt(
  persona: Persona,
  ctx: LetterContext,
): string {
  const exchange: string[] = [];
  if (ctx.chosenLabel) {
    exchange.push(
      "## What they decided",
      ctx.chosenLabel,
      "",
    );
  }
  if (ctx.playerReply) {
    exchange.push("## What they wrote back", ctx.playerReply, "");
  }

  return [
    `Write in: ${ctx.language}`,
    `## Year (player age): ${ctx.year}`,
    `## Your relationship with them: ${ctx.affinity}/100`,
    "",
    "## What you are writing about",
    OCCASION_BRIEF[ctx.occasion],
    "",
    ...exchange,
    "## What happened to them this year",
    ctx.recent.length > 0 ? ctx.recent.map((l) => `- ${l}`).join("\n") : "- (nothing notable)",
    "",
    "## Your own situation",
    ctx.situation.length > 0 ? ctx.situation.map((l) => `- ${l}`).join("\n") : "- (nothing notable)",
    "",
    "## Everything the game knows about them",
    JSON.stringify(ctx.player, null, 2),
    "",
    `Write the message now, as ${persona.npcId}.`,
  ].join("\n");
}

export function letterMessages(
  persona: Persona,
  ctx: LetterContext,
): ChatMessage[] {
  return [
    { role: "system", content: letterSystemPrompt(persona, ctx) },
    { role: "user", content: letterUserPrompt(persona, ctx) },
  ];
}

/**
 * Whether the writer should be allowed to demand an answer.
 *
 * A decision is the expensive kind of message — it takes over the screen — so
 * only the decisive get one, and the service caps them at one per year on top.
 */
export function wantsDecision(persona: Persona, roll: number): boolean {
  return roll < persona.decisive;
}
