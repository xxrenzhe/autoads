// Internationalization configuration
export const i18nConfig = {
  defaultLocale: 'en',
  locales: ['en', 'zh', 'es', 'fr', 'de', 'ja'],
  namespaces: ['common', 'dashboard', 'admin', 'features', 'pricing', 'auth'],
  fallbackLng: 'en',
  debug: process.env.NODE_ENV === 'development',
  interpolation: {
    escapeValue: false // React already escapes values
  }
} as const

export type Locale = typeof i18nConfig.locales[number]
export type Namespace = typeof i18nConfig.namespaces[number]

// Language display names
export const languageNames: Record<Locale, { native: string; english: string }> = {
  en: { native: 'English', english: 'English' },
  zh: { native: '中文', english: 'Chinese' },
  es: { native: 'Español', english: 'Spanish' },
  fr: { native: 'Français', english: 'French' },
  de: { native: 'Deutsch', english: 'German' },
  ja: { native: '日本語', english: 'Japanese' }
}

// RTL languages
export const rtlLanguages: Locale[] = []

// Date and number formatting
export const formatters = {
  date: (locale: Locale) => new Intl.DateTimeFormat(locale),
  time: (locale: Locale) => new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit'
  }),
  dateTime: (locale: Locale) => new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }),
  number: (locale: Locale) => new Intl.NumberFormat(locale),
  currency: (locale: Locale, currency: string = 'USD') => new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }),
  percent: (locale: Locale) => new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })
}

// Pluralization rules
export const pluralRules = {
  en: (count: number) => count === 1 ? 'one' : 'other',
  zh: () => 'other', // Chinese doesn't have plural forms
  es: (count: number) => count === 1 ? 'one' : 'other',
  fr: (count: number) => count <= 1 ? 'one' : 'other',
  de: (count: number) => count === 1 ? 'one' : 'other',
  ja: () => 'other' // Japanese doesn't have plural forms
}