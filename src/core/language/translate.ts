import { worldTranslation } from "./WorldTranslations.js";

/**
 * Translation lookup, React-free so every caller (the `useI18n` hook, the
 * module-level translator plugins use, the console) resolves keys the same way.
 */
export type TranslationData = Record<string, string>;

export interface TranslationSources {
  /** The selected language pack. */
  translations: TranslationData;
  /** The active world's own overlay — wins over the base pack. */
  langCode: string;
  /** Enabled mods' packs, in load order. */
  modTranslations: TranslationData[];
}

/**
 * Resolve a key: base pack → world overlay → mod packs → the key itself.
 *
 * Falling back to the key is deliberate. A missing translation shows up as
 * `some.key` on screen, which is ugly but diagnosable, where an empty string
 * would silently swallow the text.
 */
export function resolveTranslation(
  sources: TranslationSources,
  key: string,
  params?: Record<string, string | number>,
): string {
  let text: string | undefined = sources.translations[key];

  if (text === undefined) {
    text = worldTranslation(key, sources.langCode);
  }

  if (text === undefined) {
    for (const modTrans of sources.modTranslations) {
      text = modTrans[key];
      if (text !== undefined) break;
    }
  }

  if (text === undefined) text = key;

  if (params) {
    for (const [name, value] of Object.entries(params)) {
      // split/join on the literal `{name}` token — no RegExp, so a param name
      // containing regex metacharacters can never throw or over-match.
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
