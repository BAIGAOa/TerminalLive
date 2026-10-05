import { inWindow, type AgeWindow } from "./AgeWindow.js";
import type { NpcAutonomyDef } from "./NpcAutonomy.js";
import type { NpcDefinition } from "./NpcDefinition.js";
import type { NpcInteractionDef } from "./NpcInteraction.js";
import { ROLE_KNOW_WINDOW } from "./NpcRoles.js";
import type { NpcSchemeResult, NpcYearContext } from "./NpcScheme.js";
import { DEFAULT_TRAITS, ROLE_TRAITS } from "./NpcTraits.js";
import type { NpcSimEvent, NpcTraits } from "./NpcState.js";

/** A concrete archetype constructor, registered by name in NpcTypeRegistry. */
export interface NpcConstructor {
  new (def: NpcDefinition): Npc;
}

/**
 * The base NPC class. It owns an {@link NpcDefinition} (parsed from JSON by
 * {@link NpcLoader}) and adds *behaviour*, mirroring how `Incident` subclasses
 * add behaviour to event JSON. The `type` field in the JSON picks the class;
 * with no `type`, {@link NpcTypeRegistry} infers one from `roleKey`.
 *
 * Subclasses override the behaviour hooks (`traits`, the age windows, and —
 * for NPC↔NPC influence — `peerScheme`/`reactToPeer`). Every data field is
 * exposed as a delegating getter with the same name as on `NpcDefinition`, so
 * existing call sites that read `npc.roleKey` / `npc.initial` / … keep working.
 */
export abstract class Npc {
  public readonly def: NpcDefinition;
  public readonly id: string;
  public readonly type: string;
  public readonly params: Record<string, unknown>;

  constructor(def: NpcDefinition) {
    this.def = def;
    this.id = def.id;
    this.type = def.type ?? "generic";
    this.params = def.params ?? {};
  }

  /**
   * Parse custom `params` into typed fields. Called by the factory *after*
   * construction — not from the constructor — because a subclass's field
   * initializers run only after `super()` returns, and would otherwise clobber
   * anything `parseParams` set.
   */
  public init(): this {
    this.parseParams(this.params);
    return this;
  }

  // ── delegating getters (legacy NpcDefinition surface) ───────────
  public get labelKey(): string {
    return this.def.labelKey;
  }
  public get descKey(): string {
    return this.def.descKey;
  }
  public get roleKey(): string | undefined {
    return this.def.roleKey;
  }
  public get initial(): number {
    return this.def.initial ?? 0;
  }
  public get startAge(): number | undefined {
    return this.def.startAge;
  }
  public get kinOf(): string[] | undefined {
    return this.def.kinOf;
  }
  public get partnerOf(): string | undefined {
    return this.def.partnerOf;
  }
  public get temperamentKey(): string | undefined {
    return this.def.temperamentKey;
  }
  public get dialogueKeys(): string[] {
    return this.def.dialogueKeys ?? [];
  }
  public get interactions(): NpcInteractionDef[] | undefined {
    return this.def.interactions;
  }
  public get autonomy(): NpcAutonomyDef[] | undefined {
    return this.def.autonomy;
  }

  // ── behaviour hooks ─────────────────────────────────────────────
  /** Parse type-specific custom fields out of `params`. No-op by default. */
  protected parseParams(_params: Record<string, unknown>): void {}

  /** Personality axes; defaults to the role table so untyped NPCs behave as before. */
  public traits(): NpcTraits {
    return ROLE_TRAITS[this.roleKey ?? ""] ?? DEFAULT_TRAITS;
  }

  /** When the player comes to know this NPC (from role, unless the def overrides). */
  public playerAgeWindow(): AgeWindow {
    return ROLE_KNOW_WINDOW[this.roleKey ?? ""] ?? {};
  }

  public knowsAt(playerAge: number): boolean {
    if (this.def.knownFromAge !== undefined || this.def.knownUntilAge !== undefined) {
      return inWindow(playerAge, {
        min: this.def.knownFromAge,
        max: this.def.knownUntilAge,
      });
    }
    return inWindow(playerAge, this.playerAgeWindow());
  }

  /** Extra autonomy defs this archetype adds on top of its role table. */
  public extraAutonomy(): NpcAutonomyDef[] {
    return [];
  }

  /** Extra player-initiated interactions this archetype adds. */
  public extraInteractions(): NpcInteractionDef[] {
    return [];
  }

  /** Age window applied to this archetype's autonomy defs (belt-and-braces). */
  public autonomyAgeWindow(): AgeWindow {
    return {};
  }

  /** Age window applied to this archetype's interaction defs. */
  public interactionAgeWindow(): AgeWindow {
    return {};
  }

  /** A yearly behaviour against another NPC and/or the player. */
  public peerScheme(_ctx: NpcYearContext): NpcSchemeResult[] {
    return [];
  }

  /** React to a peer's life event this year. */
  public reactToPeer(
    _ev: NpcSimEvent,
    _ctx: NpcYearContext,
  ): NpcSchemeResult | null {
    return null;
  }
}
