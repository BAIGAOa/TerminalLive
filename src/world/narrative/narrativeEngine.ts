/**
 * Pure long-form narrative arcs: a handful of life "through-lines" (scholar,
 * entrepreneur, revenge, family) that advance through stages as the player's
 * stats, flags, karma and bonds cross thresholds. No container, no React —
 * `NarrativeSystem` is a thin shell over it.
 */

export interface ArcRequirement {
  minStats?: Record<string, number>;
  flags?: string[];
  minKarma?: Record<string, number>;
  minRelationship?: number;
  minCareerRank?: number;
  hasCareer?: boolean;
}

export interface ArcStageDef {
  id: string;
  labelKey: string;
  requires?: ArcRequirement;
}

export interface ArcDef {
  id: string;
  labelKey: string;
  descKey?: string;
  stages: ArcStageDef[];
}

export interface ArcState {
  id: string;
  /** Number of stages completed (0 = not started). */
  stage: number;
  startedAge: number;
  completedAge?: number;
}

export interface NarrativeState {
  arcs: Record<string, ArcState>;
  milestones: string[];
}

export interface ArcContext {
  age: number;
  stats: Record<string, number>;
  flags: Set<string>;
  karma: Record<string, number>;
  maxRelationship: number;
  careerRank: number;
  hasCareer: boolean;
}

export interface ArcEvent {
  arcId: string;
  stage: number;
  labelKey: string;
  kind: "started" | "advanced" | "completed";
}

export function emptyNarrative(): NarrativeState {
  return { arcs: {}, milestones: [] };
}

export function meetsArcReq(
  req: ArcRequirement | undefined,
  ctx: ArcContext,
): boolean {
  if (!req) return true;
  if (req.minStats) {
    for (const [k, v] of Object.entries(req.minStats)) {
      if ((ctx.stats[k] ?? 0) < v) return false;
    }
  }
  if (req.flags && !req.flags.every((f) => ctx.flags.has(f))) return false;
  if (req.minKarma) {
    for (const [axis, v] of Object.entries(req.minKarma)) {
      if ((ctx.karma[axis] ?? 0) < v) return false;
    }
  }
  if (req.minRelationship !== undefined && ctx.maxRelationship < req.minRelationship) {
    return false;
  }
  if (req.minCareerRank !== undefined && ctx.careerRank < req.minCareerRank) {
    return false;
  }
  if (req.hasCareer && !ctx.hasCareer) return false;
  return true;
}

/**
 * Advance every arc: start one whose first stage holds, then push it forward
 * through as many consecutive stages as their requirements allow.
 */
export function tickArcs(
  state: NarrativeState,
  defs: Record<string, ArcDef>,
  ctx: ArcContext,
): ArcEvent[] {
  const events: ArcEvent[] = [];

  for (const def of Object.values(defs)) {
    if (def.stages.length === 0) continue; // guard: a malformed mod arc
    let arc = state.arcs[def.id];
    if (arc && arc.stage >= def.stages.length) continue;

    if (!arc) {
      if (!meetsArcReq(def.stages[0]?.requires, ctx)) continue;
      arc = { id: def.id, stage: 1, startedAge: ctx.age };
      state.arcs[def.id] = arc;
      state.milestones.push(`${def.id}:0`);
      // A one-stage arc is complete the moment it starts.
      const done = def.stages.length === 1;
      if (done) arc.completedAge = ctx.age;
      events.push({
        arcId: def.id,
        stage: 1,
        labelKey: def.stages[0].labelKey,
        kind: done ? "completed" : "started",
      });
    }

    while (
      arc.stage < def.stages.length &&
      meetsArcReq(def.stages[arc.stage]?.requires, ctx)
    ) {
      const next = def.stages[arc.stage];
      arc.stage += 1;
      state.milestones.push(`${def.id}:${arc.stage - 1}`);
      const done = arc.stage >= def.stages.length;
      if (done) arc.completedAge = ctx.age;
      events.push({
        arcId: def.id,
        stage: arc.stage,
        labelKey: next.labelKey,
        kind: done ? "completed" : "advanced",
      });
    }
  }

  return events;
}

/** Active arcs with their progress, newest milestone first. */
export function activeArcs(
  state: NarrativeState,
  defs: Record<string, ArcDef>,
): Array<{ def: ArcDef; state: ArcState }> {
  return Object.values(state.arcs)
    .map((arc) => ({ def: defs[arc.id], state: arc }))
    .filter((a) => a.def);
}

export function arcProgress(arc: ArcState, def: ArcDef): number {
  const total = def.stages.length;
  return total === 0 ? 0 : Math.round((arc.stage / total) * 100);
}
