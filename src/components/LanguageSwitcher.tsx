"use client";

import { localeNames, locales } from "@/i18n/config";
import { useI18n } from "@/i18n/I18nProvider";

interface Props {
  /** Called right before navigating, so the caller can save in-progress state. */
  onBeforeSwitch: () => void;
}

export function LanguageSwitcher({ onBeforeSwitch }: Props) {
  const { locale, dict } = useI18n();

  return (
    <nav aria-label={dict.app.language} className="flex shrink-0 rounded-lg border border-line bg-panel p-0.5 text-sm">
      {locales.map((l) => {
        const active = l === locale;
        return (
          <a
            key={l}
            href={`/${l}`}
            hrefLang={l}
            lang={l === "zh" ? "zh-Hans" : l}
            aria-current={active ? "page" : undefined}
            onClick={(e) => {
              if (active) e.preventDefault();
              else onBeforeSwitch();
            }}
            className={`rounded-md px-3 py-1 font-medium transition ${
              active ? "bg-brass/20 text-brass-bright" : "text-ink-soft hover:text-ink"
            }`}
          >
            {localeNames[l]}
          </a>
        );
      })}
    </nav>
  );
}
