"use client";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect } from "react";
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
const logger = createClientLogger('LanguageSwitcher');


export default function LanguageSwitcher() {
  const { locale, setLocale, t, isLoading } = useLanguage();

  // 动态设置html lang属性
  useEffect(() => {
    if (typeof document !== "undefined") => {
      document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    }
  }, [locale]);
  const handleLanguageChange = (newLocale: "en" | "zh") => {
    logger.info(`语言切换器: 从 ${locale} 切换到 ${newLocale}`);
    setLocale(newLocale);
  };

  // 如果语言还在加载中，显示加载状态
  if (isLoading) => {
    return (
      <div className="flex rounded-lg border border-gray-200 bg-white">
        <div className="h-8 w-8 bg-gray-200 rounded-l-md animate-pulse" />
        <div className="h-8 w-8 bg-gray-200 rounded-r-md animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex rounded-lg border border-gray-200 bg-white">
        <Button
          variant={locale === "en" ? "default" : "ghost"}
          size="sm"
          onClick={() => handleLanguageChange("en")}
          className="rounded-r-none text-xs px-3 py-1"
        >
          EN
        </Button>
        <Button
          variant={locale === "zh" ? "default" : "ghost"}
          size="sm"
          onClick={() => handleLanguageChange("zh")}
          className="rounded-l-none text-xs px-3 py-1"
        >
          中文
        </Button>
      </div>
  );
}
