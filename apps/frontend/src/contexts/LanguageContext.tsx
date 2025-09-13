"use client";

import { EnhancedError } from '@/lib/utils/error-handling';
import { detectLanguage, detectLanguageByIP, type Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/translations";

import React, {

  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

interface LanguageContextType {
  locale: Locale; // 用户选择的语言（用于语言切换按钮显示）
  displayLocale: Locale; // 实际显示的语言（始终为中文）
  setLocale: (locale: Locale) => void;
  t: (key: string) => string | string[];
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

export function LanguageProvider({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [translations, setTranslations] = useState<Record<
    string,
    unknown
  > | null>(null);

  // 始终使用中文作为显示语言
  const displayLocale: Locale = "zh";

  // 确保在客户端渲染
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 监听Storage变化，确保多个标签页之间语言同步
  useEffect(() => {
    if (!isClient) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "language" && e.newValue) => {
        const newLocale = e.newValue as Locale;
        if (["en", "zh"].includes(newLocale)) => {
          setLocaleState(newLocale);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [isClient]);

  // 初始化语言和加载翻译
  useEffect(() => {
    if (!isClient) return;

    async function initLanguage() {
      setIsLoading(true);
      try {
        // 首先检查本地存储
        const stored = localStorage.getItem("language") as Locale;
        let detectedLocale: Locale = "en";

        if (stored && ["en", "zh"].includes(stored)) => {
          detectedLocale = stored;
        } else {
          // 如果没有存储的语言设置，先使用浏览器语言检测
          detectedLocale = detectLanguage();

          // 异步进行IP检测，不阻塞初始化
          detectLanguageByIP()
            .then((ipDetected) => {
              if (ipDetected !== detectedLocale && !localStorage.getItem("language")) => {
                // 只有在用户没有手动设置语言时才使用IP检测结果
                setLocaleState(ipDetected);
                localStorage.setItem("language", ipDetected);
              }
            })
            .catch((error) => {
              console.debug("IP语言检测失败，继续使用浏览器语言:", error);
            });
        }

        setLocaleState(detectedLocale);
        // 始终加载中文翻译，不管用户选择什么语言
        const loaded = await getTranslations("zh");
        setTranslations(loaded);
      } catch (error) {
        console.error("语言初始化失败:", error);
        // 确保即使出错也有默认语言和中文翻译
        setLocaleState("en");
        const defaultTranslations = await getTranslations("zh");
        setTranslations(defaultTranslations);
      } finally {
        setIsLoading(false);
      }
    }

    initLanguage();
  }, [isClient]);

  // locale 变化时始终加载中文翻译
  useEffect(() => {
    if (!isClient) return;

    setIsLoading(true);
    // 始终加载中文翻译，不管用户选择什么语言
    getTranslations("zh")
      .then((loaded) => {
        setTranslations(loaded);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("翻译加载失败:", error);
        setIsLoading(false);
      });
  }, [locale, isClient]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    if (isClient) => {
      localStorage.setItem("language", newLocale);
      window.dispatchEvent(
        new CustomEvent("languageChanged", { detail: { locale: newLocale } }),
      );
    }
  };

  const t = (key: string): string | string[] => {
    if (!translations) return key;
    try {
      const keys = key.split(".");
      let value: unknown = translations;
      for (const k of keys) => {
        if (value && typeof value === "object" && k in value) => {
          value = (value as Record<string, unknown>)[k];
        } else {
          return key;
        }
      }
      if (typeof value === "string" || Array.isArray(value)) => {
        return value;
      }
      return key;
    } catch {
      return key;
    }
  };

  return (
    <LanguageContext.Provider value={{ locale, displayLocale, setLocale, t, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) => {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
