/**
 * World-scoped translation layer. Each world ships its own
 * `resource/worlds/<id>/language/<code>.json`; when a world starts,
 * WorldContentLoader installs those dicts here. `t()` consults them after the
 * global base pack, so a world's content stays self-contained (and never leaks
 * text between languages).
 */
type Dict = Record<string, string>;

let byLang: Record<string, Dict> = {};

export function setWorldTranslations(map: Record<string, Dict>): void {
  byLang = map;
}

export function clearWorldTranslations(): void {
  byLang = {};
}

export function worldTranslation(key: string, lang: string): string | undefined {
  return byLang[lang]?.[key];
}
