export const locales = ["en", "zh"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const isLocale = (value: string | undefined): value is Locale =>
  value !== undefined && (locales as readonly string[]).includes(value);

/** BCP 47 tag for the `<html lang>` attribute. */
export const htmlLang: Record<Locale, string> = { en: "en", zh: "zh-Hans" };

/** Native names, shown in the language switcher. */
export const localeNames: Record<Locale, string> = { en: "EN", zh: "中文" };

/**
 * Pick the best supported locale from an Accept-Language header,
 * honoring q-values (e.g. "fr;q=0.9, zh-CN;q=0.8, en;q=0.5" -> "zh").
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return defaultLocale;
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const quality = q ? Number(q.slice(2)) : 1;
      return { base: tag.trim().toLowerCase().split("-")[0], quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((l) => l.base && l.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  for (const { base } of ranked) {
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}
