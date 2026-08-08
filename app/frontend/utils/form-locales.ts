export const defaultFormLocale = 'zh-CN';

export const formLocaleLabels = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
} satisfies Record<string, string>;

export function canonicalizeFormLocale(value: string): string | null {
  try {
    return Intl.getCanonicalLocales(value.trim())[0] ?? null;
  } catch {
    return null;
  }
}

export function detectFormLocale(languages: readonly string[] | undefined): string {
  return (languages ?? [])
    .map((language) => canonicalizeFormLocale(language))
    .find((locale): locale is string => locale !== null) ?? defaultFormLocale;
}

export function getBrowserFormLocale(): string {
  if (typeof navigator === 'undefined') return defaultFormLocale;
  return detectFormLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

export function formatFormLocale(locale: string): string {
  const known = formLocaleLabels[locale as keyof typeof formLocaleLabels];
  if (known) return `${known} (${locale})`;
  try {
    const { language } = new Intl.Locale(locale);
    const label = new Intl.DisplayNames([defaultFormLocale], { type: 'language' }).of(language);
    return label ? `${label} (${locale})` : locale;
  } catch {
    return locale;
  }
}

export function orderFormLocales(
  defaultLocale: string,
  locales: Iterable<string>,
): string[] {
  return [defaultLocale, ...new Set(locales)]
    .filter((locale, index, values) => locale.length > 0 && values.indexOf(locale) === index);
}
