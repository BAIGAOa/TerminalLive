/** Modal-layer ids shared by their opener/opener helpers and the hooks that
 * need to dismiss them without importing the whole layer module (which would
 * create an import cycle). */
export const CONSOLE_LAYER_ID = "console-layer";
export const NPC_MODAL_ID = "npc-modal";
export const GJ_MODAL_ID = "gj-modal";
/** The AI correspondence inbox. */
export const MAILBOX_MODAL_ID = "mailbox-modal";
/** The one popup a decision-carrying letter is allowed to raise. */
export const MAIL_DECISION_MODAL_ID = "mail-decision-modal";
