import { Npc } from "../Npc.js";

/**
 * The fallback archetype: an untyped / unknown-type NPC. It inherits the base
 * behaviour (role traits, role know-window) and adds no schemes, so old content
 * and third-party JSON keep working unchanged.
 */
export class GenericNpc extends Npc {}
