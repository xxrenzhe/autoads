// Translation utilities and hooks
import { useState, useEffect } from 'react'
import { i18nConfig, Locale, Namespace, formatters, pluralRules } from './i18n-config'

export interface TranslationResource {
  [key: string]: string | TranslationResource
}

export interface TranslationOptions {
  count?: number
  context?: string
  defaultValue?: string
  interpolation?: Record<string, string | number>
}

export class TranslationManager {
  private translations: Record<Locale, Record<Namespace, TranslationResource>> = {} as any
  private currentLocale: Locale = i18nConfig.defaultLocale
  private loadedNamespaces: Set<string> = new Set()

  /**
   * Initialize translation manager
   */
  async initialize(locale: Locale = i18nConfig.defaultLocale): Promise<void> {
    this.currentLocale = locale
    
    // Load default namespace
    await this.loadNamespace('common', locale)
  }

  /**
   * Load translation namespace
   */
  async loadNamespace(namespace: Namespace, locale: Locale = this.currentLocale): Promise<void> {
    const key = `${locale}:${namespace}`
    
    if (this.loadedNamespaces.has(key)) {
      return
    }

    try {
      // In a real implementation, this would load from files or API
      const translations = await this.loadTranslationFile(namespace, locale)
      
      if (!this.translations[locale]) {
        this.translations[locale] = {} as any
      }
      
      this.translations[locale][namespace] = translations
      this.loadedNamespaces.add(key)
    } catch (error) {
      console.error(`Failed to load translations for ${namespace}:${locale}`, error)
      
      // Fallback to default locale
      if (locale !== i18nConfig.defaultLocale) {
        await this.loadNamespace(namespace, i18nConfig.defaultLocale)
      }
    }
  }

  /**
   * Get translation
   */
  t(
    key: string, 
    options: TranslationOptions = {},
    namespace: Namespace = 'common',
    locale: Locale = this.currentLocale
  ): string {
    const translation = this.getTranslation(key, namespace, locale)
    
    if (!translation) {
      return options.defaultValue || key
    }

    return this.processTranslation(translation, options, locale)
  }

  /**
   * Get translation with pluralization
   */
  tPlural(
    key: string,
    count: number,
    options: Omit<TranslationOptions, 'count'> = {},
    namespace: Namespace = 'common',
    locale: Locale = this.currentLocale
  ): string {
    const pluralForm = pluralRules[locale](count)
    const pluralKey = `${key}_${pluralForm}`
    
    return this.t(pluralKey, { ...options, count }, namespace, locale)
  }

  /**
   * Change locale
   */
  async changeLocale(locale: Locale): Promise<void> {
    if (!i18nConfig.locales.includes(locale)) {
      throw new Error(`Unsupported locale: ${locale}`)
    }

    this.currentLocale = locale
    
    // Load common namespace for new locale
    await this.loadNamespace('common', locale)
    
    // Update document language
    document.documentElement.lang = locale
    
    // Update document direction for RTL languages
    document.documentElement.dir = this.isRTL(locale) ? 'rtl' : 'ltr'
    
    // Store preference
    localStorage.setItem('preferred-locale', locale)
  }

  /**
   * Get current locale
   */
  getCurrentLocale(): Locale {
    return this.currentLocale
  }

  /**
   * Check if locale is RTL
   */
  isRTL(locale: Locale = this.currentLocale): boolean {
    return ['ar', 'he', 'fa'].includes(locale)
  }

  /**
   * Format date
   */
  formatDate(date: Date, locale: Locale = this.currentLocale): string {
    return formatters.date(locale).format(date)
  }

  /**
   * Format time
   */
  formatTime(date: Date, locale: Locale = this.currentLocale): string {
    return formatters.time(locale).format(date)
  }

  /**
   * Format date and time
   */
  formatDateTime(date: Date, locale: Locale = this.currentLocale): string {
    return formatters.dateTime(locale).format(date)
  }

  /**
   * Format number
   */
  formatNumber(number: number, locale: Locale = this.currentLocale): string {
    return formatters.number(locale).format(number)
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number, currency: string = 'USD', locale: Locale = this.currentLocale): string {
    return formatters.currency(locale, currency).format(amount)
  }

  /**
   * Format percentage
   */
  formatPercent(value: number, locale: Locale = this.currentLocale): string {
    return formatters.percent(locale).format(value / 100)
  }

  /**
   * Private methods
   */
  private async loadTranslationFile(namespace: Namespace, locale: Locale): Promise<TranslationResource> {
    // This would load actual translation files
    // For now, return sample translations
    const sampleTranslations: Record<string, TranslationResource> = {
      'common:en': {
        welcome: 'Welcome',
        loading: 'Loading...',
        error: 'An error occurred',
        success: 'Success',
        cancel: 'Cancel',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        create: 'Create',
        search: 'Search',
        filter: 'Filter',
        sort: 'Sort',
        export: 'Export',
        import: 'Import',
        refresh: 'Refresh',
        back: 'Back',
        next: 'Next',
        previous: 'Previous',
        close: 'Close',
        open: 'Open',
        yes: 'Yes',
        no: 'No',
        ok: 'OK'
      },
      'common:zh': {
        welcome: '欢迎',
        loading: '加载中...',
        error: '发生错误',
        success: '成功',
        cancel: '取消',
        save: '保存',
        delete: '删除',
        edit: '编辑',
        create: '创建',
        search: '搜索',
        filter: '筛选',
        sort: '排序',
        export: '导出',
        import: '导入',
        refresh: '刷新',
        back: '返回',
        next: '下一步',
        previous: '上一步',
        close: '关闭',
        open: '打开',
        yes: '是',
        no: '否',
        ok: '确定'
      },
      'dashboard:en': {
        title: 'Dashboard',
        overview: 'Overview',
        analytics: 'Analytics',
        settings: 'Settings',
        profile: 'Profile',
        tokens: 'Tokens',
        usage: 'Usage',
        balance: 'Balance',
        subscription: 'Subscription'
      },
      'dashboard:zh': {
        title: '仪表板',
        overview: '概览',
        analytics: '分析',
        settings: '设置',
        profile: '个人资料',
        tokens: '代币',
        usage: '使用情况',
        balance: '余额',
        subscription: '订阅'
      }
    }

    const key = `${namespace}:${locale}`
    return sampleTranslations[key] || {}
  }

  private getTranslation(key: string, namespace: Namespace, locale: Locale): string | null {
    const namespaceTranslations = this.translations[locale]?.[namespace]
    if (!namespaceTranslations) {
      return null
    }

    return this.getNestedValue(namespaceTranslations, key)
  }

  private getNestedValue(obj: TranslationResource, path: string): string | null {
    const keys = path.split('.')
    let current: any = obj

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key]
      } else {
        return null
      }
    }

    return typeof current === 'string' ? current : null
  }

  private processTranslation(translation: string, options: TranslationOptions, locale: Locale): string {
    let result = translation

    // Handle interpolation
    if (options.interpolation) {
      Object.entries(options.interpolation).forEach(([key, value]) => {
        const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
        result = result.replace(placeholder, String(value))
      })
    }

    // Handle count interpolation
    if (options.count !== undefined) {
      result = result.replace(/{{count}}/g, String(options.count))
    }

    return result
  }
}

// Export singleton instance
export const translationManager = new TranslationManager()

// React hooks
export function useTranslation(namespace: Namespace = 'common') {
  const [locale, setLocale] = useState<Locale>(i18nConfig.defaultLocale)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load saved locale preference
    const savedLocale = localStorage.getItem('preferred-locale') as Locale
    if (savedLocale && i18nConfig.locales.includes(savedLocale)) {
      setLocale(savedLocale)
    }

    // Initialize translation manager
    translationManager.initialize(locale).then(() => {
      setIsLoading(false)
    })
  }, [locale])

  const t = (key: string, options?: TranslationOptions) => {
    return translationManager.t(key, options, namespace, locale)
  }

  const tPlural = (key: string, count: number, options?: Omit<TranslationOptions, 'count'>) => {
    return translationManager.tPlural(key, count, options, namespace, locale)
  }

  const changeLanguage = async (newLocale: Locale) => {
    setIsLoading(true)
    await translationManager.changeLocale(newLocale)
    setLocale(newLocale)
    setIsLoading(false)
  }

  return {
    t,
    tPlural,
    locale,
    changeLanguage,
    isLoading,
    formatDate: (date: Date) => translationManager.formatDate(date, locale),
    formatTime: (date: Date) => translationManager.formatTime(date, locale),
    formatDateTime: (date: Date) => translationManager.formatDateTime(date, locale),
    formatNumber: (number: number) => translationManager.formatNumber(number, locale),
    formatCurrency: (amount: number, currency?: string) => translationManager.formatCurrency(amount, currency, locale),
    formatPercent: (value: number) => translationManager.formatPercent(value, locale)
  }
}

export function useLocale() {
  const [locale, setLocale] = useState<Locale>(i18nConfig.defaultLocale)

  useEffect(() => {
    const savedLocale = localStorage.getItem('preferred-locale') as Locale
    if (savedLocale && i18nConfig.locales.includes(savedLocale)) {
      setLocale(savedLocale)
    }
  }, [])

  const changeLocale = async (newLocale: Locale) => {
    await translationManager.changeLocale(newLocale)
    setLocale(newLocale)
  }

  return { locale, changeLocale }
}