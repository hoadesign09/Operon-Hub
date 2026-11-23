/**
 * Cross-project pure i18n utility engine (locale normalization, cookie parsing, template interpolation, dictionary resolver).
 * Dependencies: None
 * Input/Output: Pure functions accepting supported locales, dictionaries, keys, and interpolation params.
 * Example:
 *   const t = createTranslator({ vi: { hi: 'Xin chào {name}' }, en: { hi: 'Hello {name}' } }, { fallbackLocale: 'vi' });
 *   t.translate('en', 'hi', { name: 'An' }); // => 'Hello An'
 */

export type TranslationParams = Record<string, string | number | null | undefined>;

export interface TranslatorOptions<TLocale extends string> {
  fallbackLocale: NoInfer<TLocale>;
}

export interface Translator<TLocale extends string, TKey extends string> {
  translate: (locale: TLocale, key: TKey, params?: TranslationParams) => string;
}

const TEMPLATE_TOKEN_REGEX = /\{([a-zA-Z0-9_]+)\}/g;

/**
 * Normalizes a raw locale string (e.g. 'en-US', 'VI', 'fr') against a list of supported locales.
 */
export function normalizeLocale<TLocale extends string>(
  rawLocale: string | null | undefined,
  supportedLocales: readonly TLocale[],
  fallbackLocale: TLocale,
): TLocale {
  if (!rawLocale || typeof rawLocale !== 'string') {
    return fallbackLocale;
  }

  const trimmed = rawLocale.trim().toLowerCase();
  if (!trimmed) {
    return fallbackLocale;
  }

  const exactMatch = supportedLocales.find((loc) => loc.toLowerCase() === trimmed);
  if (exactMatch) {
    return exactMatch;
  }

  const baseLang = trimmed.split(/[-_]/)[0] ?? '';
  const baseMatch = supportedLocales.find((loc) => loc.toLowerCase() === baseLang);
  return baseMatch ?? fallbackLocale;
}

/**
 * Extracts a single cookie value from a Cookie header string or `document.cookie`.
 */
export function parseCookieValue(
  cookieString: string | null | undefined,
  cookieName: string,
): string | null {
  if (!cookieString || !cookieName) {
    return null;
  }

  const pairs = cookieString.split(';');
  for (const pair of pairs) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const name = pair.slice(0, separatorIndex).trim();
    if (name !== cookieName) {
      continue;
    }
    const rawValue = pair.slice(separatorIndex + 1).trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}

/**
 * Replaces `{param}` placeholders in a translation template with provided values.
 */
export function interpolateTemplate(
  template: string,
  params?: TranslationParams,
): string {
  if (!params) {
    return template;
  }

  return template.replace(TEMPLATE_TOKEN_REGEX, (match, token: string) => {
    const value = params[token];
    if (value === undefined || value === null) {
      return match;
    }
    return String(value);
  });
}

/**
 * Creates a pure, strongly-typed translator bound to the provided locale dictionaries.
 */
export function createTranslator<TLocale extends string, TKey extends string>(
  dictionaries: Record<TLocale, Record<TKey, string>>,
  options: TranslatorOptions<TLocale>,
): Translator<TLocale, TKey> {
  const { fallbackLocale } = options;

  return {
    translate(locale: TLocale, key: TKey, params?: TranslationParams): string {
      const activeDict = dictionaries[locale] ?? dictionaries[fallbackLocale];
      const fallbackDict = dictionaries[fallbackLocale];
      const rawTemplate = activeDict?.[key] ?? fallbackDict?.[key] ?? String(key);
      return interpolateTemplate(rawTemplate, params);
    },
  };
}
