import { NpcInteractionDef } from "../world/relationships/NpcInteraction.js";
import { NpcAutonomyDef } from "../world/relationships/NpcAutonomy.js";

/**
 * Role-driven content for the relationship system: which interactions an NPC
 * offers, and what they may do on their own. A `NpcDefinition` can override
 * either table per-NPC via its `interactions` / `autonomy` arrays.
 */
export default class RelationshipContent {
  private loaded = false;

  private interactions = new Map<string, NpcInteractionDef>();
  private roleInteractions = new Map<string, string[]>();
  private roleAutonomy = new Map<string, NpcAutonomyDef[]>();

  public load(): void {
    if (this.loaded) return;
    this.loaded = true;

    for (const def of INTERACTIONS) this.interactions.set(def.id, def);
    for (const [role, ids] of Object.entries(ROLE_INTERACTIONS)) {
      this.roleInteractions.set(role, ids);
    }
    for (const [role, defs] of Object.entries(ROLE_AUTONOMY)) {
      this.roleAutonomy.set(role, defs);
    }
  }

  public getInteraction(id: string): NpcInteractionDef | undefined {
    return this.interactions.get(id);
  }

  /** Interaction defs for a role, in declared order. */
  public interactionsForRole(roleKey?: string): NpcInteractionDef[] {
    if (!roleKey) return [];
    const ids = this.roleInteractions.get(roleKey) ?? [];
    return ids
      .map((id) => this.interactions.get(id))
      .filter((d): d is NpcInteractionDef => d !== undefined);
  }

  public autonomyForRole(roleKey?: string): NpcAutonomyDef[] {
    if (!roleKey) return [];
    return this.roleAutonomy.get(roleKey) ?? [];
  }
}

// ── interactions ──────────────────────────────────────────────────
const INTERACTIONS: NpcInteractionDef[] = [
  {
    id: "it_talk",
    labelKey: "npc.it.talk",
    descKey: "npc.it.talk.desc",
    icon: "💬",
    apCost: 1,
    affinity: 3,
    effects: { happiness: 2 },
    resultKey: "npc.it.talk.result",
  },
  {
    id: "it_gift",
    labelKey: "npc.it.gift",
    descKey: "npc.it.gift.desc",
    icon: "🎁",
    apCost: 1,
    requires: [{ prop: "money", gte: 5 }],
    effects: { money: -5, happiness: 1 },
    affinity: 8,
    resultKey: "npc.it.gift.result",
  },
  {
    id: "it_help",
    labelKey: "npc.it.help",
    descKey: "npc.it.help.desc",
    icon: "🤝",
    apCost: 1,
    effects: { social: 2, happiness: -1 },
    affinity: 6,
    resultKey: "npc.it.help.result",
  },
  {
    id: "it_confide",
    labelKey: "npc.it.confide",
    descKey: "npc.it.confide.desc",
    icon: "🫂",
    apCost: 1,
    minAffinity: 30,
    effects: { depressionValue: -8, happiness: 3 },
    affinity: 4,
    resultKey: "npc.it.confide.result",
  },
  {
    id: "it_quarrel",
    labelKey: "npc.it.quarrel",
    descKey: "npc.it.quarrel.desc",
    icon: "⚡",
    apCost: 1,
    affinity: -10,
    effects: { angerValue: 5 },
    resultKey: "npc.it.quarrel.result",
  },
  {
    id: "it_reconcile",
    labelKey: "npc.it.reconcile",
    descKey: "npc.it.reconcile.desc",
    icon: "🕊️",
    apCost: 1,
    affinity: 12,
    effects: { happiness: 4 },
    resultKey: "npc.it.reconcile.result",
  },
  {
    id: "it_activity",
    labelKey: "npc.it.activity",
    descKey: "npc.it.activity.desc",
    icon: "🎉",
    apCost: 1,
    requires: [{ prop: "money", gte: 8 }],
    effects: { money: -8, happiness: 8, fitness: 2 },
    affinity: 10,
    resultKey: "npc.it.activity.result",
  },
];

const ROLE_INTERACTIONS: Record<string, string[]> = {
  "npc.role.family": ["it_talk", "it_gift", "it_help", "it_confide", "it_activity"],
  "npc.role.friend": [
    "it_talk",
    "it_gift",
    "it_help",
    "it_confide",
    "it_quarrel",
    "it_reconcile",
    "it_activity",
  ],
  "npc.role.mentor": ["it_talk", "it_gift", "it_help", "it_confide"],
  "npc.role.partner": [
    "it_talk",
    "it_gift",
    "it_confide",
    "it_quarrel",
    "it_reconcile",
    "it_activity",
  ],
  "npc.role.work": ["it_talk", "it_gift", "it_help", "it_quarrel", "it_reconcile"],
  "npc.role.rival": ["it_talk", "it_gift", "it_quarrel", "it_reconcile"],
  "npc.role.pet": ["it_talk", "it_help", "it_activity"],
};

// ── autonomy (2 passive + 1 offer per role) ───────────────────────
const ROLE_AUTONOMY: Record<string, NpcAutonomyDef[]> = {
  "npc.role.family": [
    {
      id: "au_family_care",
      labelKey: "npc.au.family.care",
      weight: 1,
      kind: "passive",
      effects: { health: 2, happiness: 3 },
      affinity: 2,
      resultKey: "npc.au.family.care.result",
    },
    {
      id: "au_family_meal",
      labelKey: "npc.au.family.meal",
      weight: 1,
      kind: "passive",
      effects: { happiness: 4 },
      affinity: 2,
      resultKey: "npc.au.family.meal.result",
    },
    {
      id: "au_family_gathering",
      labelKey: "npc.au.family.gathering",
      weight: 1,
      kind: "offer",
      offerTextKey: "npc.au.family.gathering.text",
      options: [
        {
          id: "go",
          labelKey: "npc.offer.go",
          effects: { happiness: 6 },
          affinity: 5,
          resultKey: "npc.au.family.gathering.result.go",
        },
        {
          id: "skip",
          labelKey: "npc.offer.skip",
          effects: { happiness: -2 },
          affinity: -4,
          resultKey: "npc.au.family.gathering.result.skip",
        },
      ],
    },
  ],
  "npc.role.friend": [
    {
      id: "au_friend_gift",
      labelKey: "npc.au.friend.gift",
      weight: 1,
      kind: "passive",
      effects: { happiness: 3 },
      affinity: 3,
      resultKey: "npc.au.friend.gift.result",
    },
    {
      id: "au_friend_gossip",
      labelKey: "npc.au.friend.gossip",
      weight: 1,
      kind: "passive",
      effects: { happiness: 2, social: 1 },
      affinity: 1,
      resultKey: "npc.au.friend.gossip.result",
    },
    {
      id: "au_friend_trip",
      labelKey: "npc.au.friend.trip",
      weight: 1,
      kind: "offer",
      minAffinity: 30,
      offerTextKey: "npc.au.friend.trip.text",
      options: [
        {
          id: "go",
          labelKey: "npc.offer.go",
          effects: { happiness: 8, money: -10 },
          affinity: 6,
          resultKey: "npc.au.friend.trip.result.go",
        },
        {
          id: "decline",
          labelKey: "npc.offer.decline",
          affinity: -3,
          resultKey: "npc.au.friend.trip.result.decline",
        },
      ],
    },
    {
      id: "au_friend_confess",
      labelKey: "npc.au.friend.confess",
      weight: 1,
      kind: "offer",
      minAffinity: 70,
      offerTextKey: "npc.au.friend.confess.text",
      options: [
        {
          id: "accept",
          labelKey: "npc.offer.accept",
          effects: { happiness: 8 },
          affinity: 10,
          resultKey: "npc.au.friend.confess.result.accept",
        },
        {
          id: "gently_decline",
          labelKey: "npc.offer.decline",
          effects: { happiness: -2 },
          affinity: -4,
          resultKey: "npc.au.friend.confess.result.decline",
        },
      ],
    },
  ],
  "npc.role.mentor": [
    {
      id: "au_mentor_advice",
      labelKey: "npc.au.mentor.advice",
      weight: 1,
      kind: "passive",
      effects: { intelligence: 3 },
      affinity: 2,
      resultKey: "npc.au.mentor.advice.result",
    },
    {
      id: "au_mentor_book",
      labelKey: "npc.au.mentor.book",
      weight: 1,
      kind: "passive",
      effects: { intelligence: 2, happiness: 1 },
      affinity: 1,
      resultKey: "npc.au.mentor.book.result",
    },
    {
      id: "au_mentor_referral",
      labelKey: "npc.au.mentor.referral",
      weight: 1,
      kind: "offer",
      minAffinity: 40,
      offerTextKey: "npc.au.mentor.referral.text",
      options: [
        {
          id: "accept",
          labelKey: "npc.offer.accept",
          effects: { reputation: 5, intelligence: 3, happiness: -2 },
          affinity: 5,
          resultKey: "npc.au.mentor.referral.result.accept",
        },
        {
          id: "decline",
          labelKey: "npc.offer.decline",
          affinity: -2,
          resultKey: "npc.au.mentor.referral.result.decline",
        },
      ],
    },
  ],
  "npc.role.partner": [
    {
      id: "au_partner_support",
      labelKey: "npc.au.partner.support",
      weight: 1,
      kind: "passive",
      effects: { happiness: 4, depressionValue: -4 },
      affinity: 3,
      resultKey: "npc.au.partner.support.result",
    },
    {
      id: "au_partner_surprise",
      labelKey: "npc.au.partner.surprise",
      weight: 1,
      kind: "passive",
      effects: { happiness: 5 },
      affinity: 3,
      resultKey: "npc.au.partner.surprise.result",
    },
    {
      id: "au_partner_date",
      labelKey: "npc.au.partner.date",
      weight: 1,
      kind: "offer",
      minAffinity: 35,
      offerTextKey: "npc.au.partner.date.text",
      options: [
        {
          id: "go",
          labelKey: "npc.offer.go",
          effects: { happiness: 8, money: -12 },
          affinity: 8,
          resultKey: "npc.au.partner.date.result.go",
        },
        {
          id: "rest",
          labelKey: "npc.offer.busy",
          effects: { happiness: -3 },
          affinity: -5,
          resultKey: "npc.au.partner.date.result.busy",
        },
      ],
    },
  ],
  "npc.role.work": [
    {
      id: "au_work_bonus",
      labelKey: "npc.au.work.bonus",
      weight: 1,
      kind: "passive",
      minAffinity: 30,
      effects: { money: 15 },
      affinity: 1,
      resultKey: "npc.au.work.bonus.result",
    },
    {
      id: "au_work_pressure",
      labelKey: "npc.au.work.pressure",
      weight: 1,
      kind: "passive",
      effects: { happiness: -3, angerValue: 3 },
      affinity: -1,
      resultKey: "npc.au.work.pressure.result",
    },
    {
      id: "au_work_overtime",
      labelKey: "npc.au.work.overtime",
      weight: 1,
      kind: "offer",
      offerTextKey: "npc.au.work.overtime.text",
      options: [
        {
          id: "accept",
          labelKey: "npc.offer.accept",
          effects: { money: 25, health: -4, happiness: -4 },
          affinity: 4,
          resultKey: "npc.au.work.overtime.result.accept",
        },
        {
          id: "refuse",
          labelKey: "npc.offer.refuse",
          affinity: -4,
          resultKey: "npc.au.work.overtime.result.refuse",
        },
      ],
    },
  ],
  "npc.role.pet": [
    {
      id: "au_pet_cuddle",
      labelKey: "npc.au.pet.cuddle",
      weight: 1,
      kind: "passive",
      effects: { happiness: 4 },
      affinity: 3,
      resultKey: "npc.au.pet.cuddle.result",
    },
    {
      id: "au_pet_mischief",
      labelKey: "npc.au.pet.mischief",
      weight: 1,
      kind: "passive",
      effects: { happiness: 2, angerValue: 2 },
      affinity: 1,
      resultKey: "npc.au.pet.mischief.result",
    },
    {
      id: "au_pet_lost",
      labelKey: "npc.au.pet.lost",
      weight: 1,
      kind: "offer",
      offerTextKey: "npc.au.pet.lost.text",
      options: [
        {
          id: "search",
          labelKey: "npc.offer.search",
          effects: { happiness: 3, fitness: -1, money: -5 },
          affinity: 8,
          resultKey: "npc.au.pet.lost.result.search",
        },
        {
          id: "wait",
          labelKey: "npc.offer.wait",
          effects: { happiness: -4 },
          affinity: -3,
          resultKey: "npc.au.pet.lost.result.wait",
        },
      ],
    },
  ],

  // ── a rival who schemes against you ──
  "npc.role.rival": [
    {
      id: "au_rival_rumor",
      labelKey: "npc.au.rival.rumor",
      weight: 1,
      kind: "passive",
      effects: { reputation: -3, happiness: -2 },
      affinity: -1,
      resultKey: "npc.au.rival.rumor.result",
    },
    {
      id: "au_rival_snub",
      labelKey: "npc.au.rival.snub",
      weight: 1,
      kind: "passive",
      effects: { happiness: -2, angerValue: 3 },
      resultKey: "npc.au.rival.snub.result",
    },
    {
      id: "au_rival_sabotage",
      labelKey: "npc.au.rival.sabotage",
      weight: 1,
      kind: "offer",
      maxAffinity: 35,
      offerTextKey: "npc.au.rival.sabotage.text",
      options: [
        {
          id: "expose",
          labelKey: "npc.offer.expose",
          effects: { reputation: 3, happiness: -2 },
          affinity: -6,
          resultKey: "npc.au.rival.sabotage.result.expose",
        },
        {
          id: "endure",
          labelKey: "npc.offer.endure",
          effects: { happiness: -4, angerValue: 4 },
          resultKey: "npc.au.rival.sabotage.result.endure",
        },
        {
          id: "retaliate",
          labelKey: "npc.offer.retaliate",
          effects: { reputation: -2, angerValue: -3, happiness: 2 },
          affinity: -10,
          karma: { rebellion: 5 },
          resultKey: "npc.au.rival.sabotage.result.retaliate",
        },
      ],
    },
    {
      id: "au_rival_poison",
      labelKey: "npc.au.rival.poison",
      weight: 1,
      kind: "offer",
      maxAffinity: 12,
      offerTextKey: "npc.au.rival.poison.text",
      options: [
        {
          id: "treat",
          labelKey: "npc.offer.treat",
          effects: { health: 6, money: -150 },
          resultKey: "npc.au.rival.poison.result.treat",
        },
        {
          id: "resist",
          labelKey: "npc.offer.resist",
          effects: { health: -8, happiness: -3 },
          buff: { id: "fx_sick", turns: 3 },
          resultKey: "npc.au.rival.poison.result.resist",
        },
        {
          id: "revenge",
          labelKey: "npc.offer.revenge",
          effects: { health: -3, angerValue: -4 },
          affinity: -12,
          karma: { rebellion: 8 },
          resultKey: "npc.au.rival.poison.result.revenge",
        },
      ],
    },
  ],

  // ── a friend whose feelings surface ──
};
