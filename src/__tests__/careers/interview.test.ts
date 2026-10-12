import { describe, it, expect } from "vitest";
import {
  applicantBrief,
  interviewMessages,
  interviewSystemPrompt,
  parseVerdict,
  pitchTooShort,
} from "../../world/careers/interview.js";
import type Player from "../../world/Player.js";

function fakePlayer(over: Record<string, unknown> = {}): Player {
  const stats = (over.stats as Record<string, number>) ?? {};
  return {
    playerName: "Ada",
    age: 30,
    careerId: null,
    careerRank: 0,
    activeEffects: [{ id: "fx_focus", remaining: 2, stacks: 1 }],
    inventory: [{ id: "item_book", count: 2 }],
    relationships: new Map([
      ["npc_boss", 40],
      ["npc_rival", 0],
    ]),
    flags: new Set(["met_mentor"]),
    getStat: (k: string) => (k === "age" ? 30 : (stats[k] ?? 10)),
    ...over,
  } as unknown as Player;
}

describe("applicantBrief", () => {
  it("sends the player's complete state, not a curated summary", () => {
    const brief = applicantBrief(fakePlayer());
    expect(brief.name).toBe("Ada");
    expect(brief.age).toBe(30);
    expect(brief.stats.length).toBeGreaterThan(10);
    expect(brief.effects).toEqual(["fx_focus"]);
    expect(brief.inventory).toEqual([{ id: "item_book", count: 2 }]);
    expect(brief.flags).toEqual(["met_mentor"]);
  });

  it("drops untouched relationships so the prompt stays about real ties", () => {
    const brief = applicantBrief(fakePlayer());
    expect(brief.relationships).toEqual([{ npc: "npc_boss", value: 40 }]);
  });

  it("does not report age twice (once as a stat, once as a field)", () => {
    const brief = applicantBrief(fakePlayer());
    expect(brief.stats.some((s) => s.key === "age")).toBe(false);
    expect(brief.age).toBe(30);
  });
});

describe("interviewMessages", () => {
  const job = {
    label: "Surgeon",
    description: "Operate.",
    gates: ["intelligence ≥70 (applicant: 80) OK"],
    ladder: [{ title: "Intern", salary: 55 }],
    mechanics: ["guild" as const],
    entrySalary: 55,
    topSalary: 300,
    lifelong: false,
  };

  it("asks for a parseable JSON verdict", () => {
    expect(interviewSystemPrompt()).toContain('"pass"');
    expect(interviewSystemPrompt()).toContain("ONLY a JSON object");
  });

  it("carries the applicant, the vacancy and the pitch", () => {
    const msgs = interviewMessages(applicantBrief(fakePlayer()), job, "I am ready.");
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[1].content).toContain("Ada");
    expect(msgs[1].content).toContain("Surgeon");
    expect(msgs[1].content).toContain("I am ready.");
  });

  it("says so explicitly when the player submitted nothing", () => {
    const msgs = interviewMessages(applicantBrief(fakePlayer()), job, "   ");
    expect(msgs[1].content).toContain("wrote nothing");
  });
});

describe("parseVerdict", () => {
  it("reads a plain JSON answer", () => {
    expect(parseVerdict('{"pass":true,"score":88,"comment":"Hired."}')).toEqual({
      pass: true,
      score: 88,
      comment: "Hired.",
    });
  });

  it("reads JSON wrapped in prose or a code fence", () => {
    const raw = 'Sure!\n```json\n{"pass": false, "score": 20, "comment": "No."}\n```';
    expect(parseVerdict(raw)).toMatchObject({ pass: false, score: 20, comment: "No." });
  });

  it("clamps a score the model invented past the range", () => {
    expect(parseVerdict('{"pass":true,"score":999}').score).toBe(100);
    expect(parseVerdict('{"pass":true,"score":-5}').score).toBe(0);
  });

  it("fills in a score and comment when the model omits them", () => {
    expect(parseVerdict('{"pass":true}')).toMatchObject({ pass: true, score: 60 });
    expect(parseVerdict('{"pass":false}')).toMatchObject({ pass: false, score: 40 });
  });

  it("fails the interview rather than the request when the answer is unreadable", () => {
    const v = parseVerdict("I refuse to answer in JSON.");
    expect(v.pass).toBe(false);
    expect(v.comment).toContain("refuse");
  });

  it("fails on an empty answer instead of throwing", () => {
    expect(parseVerdict("").pass).toBe(false);
  });
});

describe("pitchTooShort", () => {
  it("rejects a blank or stub answer before it costs a request", () => {
    expect(pitchTooShort("")).toBe(true);
    expect(pitchTooShort("   ")).toBe(true);
    expect(pitchTooShort("hi")).toBe(true);
  });

  it("accepts a real sentence", () => {
    expect(pitchTooShort("I have run three kitchens.")).toBe(false);
  });
});
