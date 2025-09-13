"use client";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export function LangSetter() {
  const { locale } = useLanguage();
  useEffect(() => {
    if (typeof document !== "undefined") => {
      document.documentElement.lang = locale;
    }
  }, [locale]);
  return null as any;
} 