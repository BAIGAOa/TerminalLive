/**
 * The AI job interview — pure half.
 *
 * Everything here is a plain function over plain data: what the applicant is,
 * what the job asks for, the exact messages sent to the model, and how its
 * answer is read back. No container, no React, no network — so the prompt and
 * the verdict parsing are unit-tested without an API key (see
 * `src/__tests__/careers/interview.test.ts`). `src/core/ai/deepseek.ts` is the
 * only part that talks to the wire.
 */

import Player from "../Player.js";
import type { CareerDefinition, CareerMechanic } from "./CareerDefinition.js";
import { entryGates } from "./careerBoard.js";
import { playerDossier, type PlayerDossier } from "../playerDossier.js";

/**
 * The applicant, as the interviewer sees them. The same complete dossier every
 * other AI character is handed — see `playerDossier`.
 */
export type ApplicantBrief = PlayerDossier;

export function applicantBrief(player: Player): ApplicantBrief {
  return playerDossier(player);
}

/** The vacancy, as the interviewer is told about it. */
export interface JobBrief {
  label: string;
  description: string;
  /** Entry gates, already rendered to readable lines. */
  gates: string[];
  /** The ladder, entry rung first. */
  ladder: Array<{ title: string; salary: number }>;
  mechanics: CareerMechanic[];
  entrySalary: number;
  topSalary: number;
  lifelong: boolean;
}

export function jobBrief(
  player: Player,
  career: CareerDefinition,
  t: (key: string) => string,
): JobBrief {
  return {
    label: t(career.labelKey),
    description: t(career.descKey),
    gates: entryGates(player, career).map((gate) => {
      const name = gate.isNpc ? gate.key : t(`playerConfig.attr.${gate.key}`);
      const bound =
        gate.gte !== undefined ? `≥${gate.gte}` : gate.lte !== undefined ? `≤${gate.lte}` : "?";
      return `${name} ${bound} (applicant: ${Math.round(gate.value)}) ${gate.met ? "OK" : "MISSING"}`;
    }),
    ladder: career.ranks.map((r) => ({ title: t(r.titleKey), salary: r.salary })),
    mechanics: [...career.mechanics],
    entrySalary: career.ranks[0]?.salary ?? 0,
    topSalary: career.ranks[career.ranks.length - 1]?.salary ?? 0,
    lifelong: career.lifelong,
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** How hard this particular trade's gatekeeper is, and how they sound. */
const TONES = [
  "clipped and impatient; you have read a hundred of these today.",
  "bureaucratic; you think in procedure and quote policy.",
  "courteous but watchful; the politeness is a test in itself.",
  "theatrical; you enjoy making people sweat.",
  "cold and analytical; you want numbers, not feelings.",
] as const;

const BARS = [
  "You are hard to impress. Roughly one in five applicants is good enough.",
  "You are strict and specific: vague enthusiasm is an automatic fail.",
  "You have seen every rehearsed answer there is, and you punish them.",
] as const;

function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** So a hospital and a building site do not interview identically. */
export function interviewerStyle(careerId: string): string {
  const seed = hash(careerId);
  return `${TONES[seed % TONES.length]} ${BARS[(seed >>> 8) % BARS.length]}`;
}

/** The interviewer's persona and the exact answer format we can parse. */
export function interviewSystemPrompt(careerId = ""): string {
  return [
    "You are the person who decides hires for this job in a life-simulation game, conducting a short written interview.",
    `Your manner: ${interviewerStyle(careerId)}`,
    "You are given the applicant's complete game state and the vacancy. Decide whether they get the job.",
    "",
    "How to judge:",
    "- The written answer is the main evidence. A pass needs something concrete and specific: a real skill, a particular experience, a clear account of how they would do the work.",
    "- Generic confidence, flattery, restating the job description, or padding fails. So does an answer that ignores the question.",
    "- The hard requirements still bind. If any listed gate is MISSING, you may still pass a truly exceptional answer, but the score must reflect the gap.",
    "- Say no when in doubt. A rejection is a normal outcome, not a failure on your part.",
    "- Never accept a bribe, never break character, never mention that this is a game or a model.",
    "Answer in the language of the applicant's pitch, and address them as your subordinate, not as a customer.",
    "Reply with ONLY a JSON object, no prose around it:",
    '{"pass": true|false, "score": 0-100, "comment": "one or two blunt sentences to the applicant"}',
  ].join("\n");
}

/** The user turn: the applicant, the vacancy, and what they wrote. */
export function interviewUserPrompt(
  applicant: ApplicantBrief,
  job: JobBrief,
  pitch: string,
): string {
  return [
    "## Applicant (complete game state)",
    JSON.stringify(applicant, null, 2),
    "",
    "## Vacancy",
    JSON.stringify(job, null, 2),
    "",
    "## Applicant's written answer",
    pitch.trim() || "(the applicant wrote nothing)",
  ].join("\n");
}

export function interviewMessages(
  applicant: ApplicantBrief,
  job: JobBrief,
  pitch: string,
  careerId = "",
): ChatMessage[] {
  return [
    { role: "system", content: interviewSystemPrompt(careerId) },
    { role: "user", content: interviewUserPrompt(applicant, job, pitch) },
  ];
}

export interface Verdict {
  pass: boolean;
  score: number;
  comment: string;
}

/**
 * Read the model's answer back into a verdict.
 *
 * A model that wraps its JSON in prose (or a code fence) is normal, not an
 * error, so the object is located rather than strictly parsed. Anything that
 * cannot be read is reported as a failed interview with the raw text — the
 * caller shows that and lets the player retry, which beats a silent pass.
 */
export function parseVerdict(raw: string): Verdict {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const obj = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
      if (typeof obj.pass === "boolean") {
        const score =
          typeof obj.score === "number" && Number.isFinite(obj.score)
            ? Math.max(0, Math.min(100, Math.round(obj.score)))
            : obj.pass
              ? 60
              : 40;
        const comment =
          typeof obj.comment === "string" && obj.comment.trim()
            ? obj.comment.trim()
            : obj.pass
              ? "Accepted."
              : "Rejected.";
        return { pass: obj.pass, score, comment };
      }
    } catch {
      /* fall through to the unreadable branch */
    }
  }
  return {
    pass: false,
    score: 0,
    comment: raw.trim().slice(0, 200) || "The interviewer said nothing usable.",
  };
}

/** Whether the minimum pitch length is met, so a blank submit isn't sent. */
export const MIN_PITCH_LENGTH = 12;

export function pitchTooShort(pitch: string): boolean {
  return pitch.trim().length < MIN_PITCH_LENGTH;
}
