/** Pure text mapping for NPC interaction unavailable-reasons (React-free). */

export type Translator = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/**
 * Translation key describing why an NPC interaction is unavailable. The
 * caller supplies `t`, so this stays pure and i18n-agnostic.
 */
export function reasonText(reason: string | undefined, t: Translator): string {
  if (reason === "ap") return t("npc.it.reason.ap");
  if (reason === "age") return t("npc.it.reason.age");
  if (reason === "gone") return t("npc.it.reason.gone");
  if (reason === "unknown") return t("npc.it.reason.unknown");
  return t("npc.it.reason.require");
}
