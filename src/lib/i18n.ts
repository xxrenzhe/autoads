import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
const logger = createClientLogger('i18n');

// 支持的语言
export type Locale = "en" | "zh";

// 默认语言
export const defaultLocale: Locale = "en";

// 根据浏览器语言检测语言（不检查localStorage）
export function detectLanguage(): Locale {
  if (typeof window === "undefined") {
    return defaultLocale;
  }

  // 检查浏览器语言偏好
  const browserLang = navigator.language.toLowerCase();

  // 中文相关的语言代码
  const chineseLocales = ["zh", "zh-cn", "zh-tw", "zh-hk", "zh-sg"];

  if (chineseLocales.some((locale) => browserLang.startsWith(locale))) {
    return "zh";
  }

  return "en";
}

// 获取IP地理位置信息（异步）
export async function detectLanguageByIP(): Promise<Locale> {
  try {
    // 使用免费的IP地理位置API，设置超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

    const response = await fetch("https://ipapi.co/json/", {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      
      // 验证响应数据格式
      if (data && typeof data === 'object' && data.country_code) {
        const country = data.country_code.toLowerCase();

        // 中文地区代码
        const chineseCountries = ["cn", "tw", "hk", "mo", "sg"];

        if (chineseCountries.includes(country)) {
          logger.info(`IP检测到中文地区: ${country}`);
          return "zh";
        } else {
          logger.info(`IP检测到非中文地区: ${country}`);
        }
      } else {
        logger.warn("IP地理位置API返回数据格式异常");
      }
    } else {
      logger.warn(`IP地理位置API响应错误: ${response.status}`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn("IP地理位置检测超时");
    } else {
      logger.warn("IP地理位置检测失败:");
    }
  }

  return detectLanguage(); // 回退到浏览器语言检测
}
