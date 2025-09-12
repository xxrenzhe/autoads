/**
 * 地理位置一致性检查工具
 * 确保IP、时区、语言等地理位置信息一致
 */

export interface GeoProfile {
  country: string;
  region?: string;
  city?: string;
  timezone: string;
  language: string;
  locale: string;
  currency?: string;
}

export interface IPGeoInfo {
  ip: string;
  country: string;
  region?: string;
  city?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  organization?: string;
}

// 主要国家/地区的地理位置配置
export const GEO_PROFILES: Record<string, GeoProfile> = {
  'US': {
    country: 'US',
    timezone: 'America/New_York',
    language: 'en-US',
    locale: 'en-US',
    currency: 'USD'
  },
  'US-LA': {
    country: 'US',
    region: 'California',
    city: 'Los Angeles',
    timezone: 'America/Los_Angeles',
    language: 'en-US',
    locale: 'en-US',
    currency: 'USD'
  },
  'US-CHI': {
    country: 'US',
    region: 'Illinois',
    city: 'Chicago',
    timezone: 'America/Chicago',
    language: 'en-US',
    locale: 'en-US',
    currency: 'USD'
  },
  'GB': {
    country: 'GB',
    timezone: 'Europe/London',
    language: 'en-GB',
    locale: 'en-GB',
    currency: 'GBP'
  },
  'DE': {
    country: 'DE',
    timezone: 'Europe/Berlin',
    language: 'de-DE',
    locale: 'de-DE',
    currency: 'EUR'
  },
  'FR': {
    country: 'FR',
    timezone: 'Europe/Paris',
    language: 'fr-FR',
    locale: 'fr-FR',
    currency: 'EUR'
  },
  'JP': {
    country: 'JP',
    timezone: 'Asia/Tokyo',
    language: 'ja-JP',
    locale: 'ja-JP',
    currency: 'JPY'
  },
  'CN': {
    country: 'CN',
    timezone: 'Asia/Shanghai',
    language: 'zh-CN',
    locale: 'zh-CN',
    currency: 'CNY'
  },
  'SG': {
    country: 'SG',
    timezone: 'Asia/Singapore',
    language: 'en-SG',
    locale: 'en-SG',
    currency: 'SGD'
  },
  'AU': {
    country: 'AU',
    timezone: 'Australia/Sydney',
    language: 'en-AU',
    locale: 'en-AU',
    currency: 'AUD'
  },
  'CA': {
    country: 'CA',
    timezone: 'America/Toronto',
    language: 'en-CA',
    locale: 'en-CA',
    currency: 'CAD'
  },
  'BR': {
    country: 'BR',
    timezone: 'America/Sao_Paulo',
    language: 'pt-BR',
    locale: 'pt-BR',
    currency: 'BRL'
  }
};

// 时区映射
export const TIMEZONE_MAPPING: Record<string, string[]> = {
  'America/New_York': ['US', 'CA'],
  'America/Los_Angeles': ['US', 'CA'],
  'America/Chicago': ['US', 'CA'],
  'Europe/London': ['GB', 'IE'],
  'Europe/Berlin': ['DE', 'AT', 'CH', 'CZ'],
  'Europe/Paris': ['FR', 'BE', 'LU', 'MC'],
  'Asia/Tokyo': ['JP'],
  'Asia/Shanghai': ['CN'],
  'Asia/Singapore': ['SG'],
  'Australia/Sydney': ['AU'],
  'America/Toronto': ['CA'],
  'America/Sao_Paulo': ['BR']
};

// 语言映射
export const LANGUAGE_MAPPING: Record<string, string[]> = {
  'en-US': ['US'],
  'en-GB': ['GB'],
  'de-DE': ['DE', 'AT', 'CH'],
  'fr-FR': ['FR', 'BE', 'LU', 'MC'],
  'ja-JP': ['JP'],
  'zh-CN': ['CN'],
  'en-SG': ['SG'],
  'en-AU': ['AU'],
  'en-CA': ['CA'],
  'pt-BR': ['BR']
};

/**
 * 地理位置一致性检查器
 */
export class GeoConsistencyChecker {
  /**
   * 根据IP地理位置信息生成一致的地理位置配置
   */
  static generateConsistentProfile(ipInfo: IPGeoInfo): GeoProfile {
    const countryCode = ipInfo.country;
    
    // 查找匹配的地理位置配置
    let profile: GeoProfile;
    
    if (ipInfo.city && ipInfo.region) {
      // 尝试找到具体的城市配置
      const cityKey = `${countryCode}-${ipInfo.region.substring(0, 3).toUpperCase()}`;
      profile = GEO_PROFILES[cityKey] || GEO_PROFILES[countryCode] || GEO_PROFILES['US'];
    } else {
      // 使用国家配置
      profile = GEO_PROFILES[countryCode] || GEO_PROFILES['US'];
    }
    
    // 如果IP有时区信息，优先使用
    if (ipInfo.timezone && TIMEZONE_MAPPING[ipInfo.timezone]?.includes(countryCode)) {
      profile.timezone = ipInfo.timezone;
    }
    
    return { ...profile };
  }
  
  /**
   * 检查地理位置配置是否一致
   */
  static checkConsistency(profile: GeoProfile, ipInfo: IPGeoInfo): {
    isConsistent: boolean;
    inconsistencies: string[];
    score: number; // 0-100分，100表示完全一致
  } {
    const inconsistencies: string[] = [];
    let score = 100;
    
    // 检查国家
    if (profile.country !== ipInfo.country) {
      inconsistencies.push(`Country mismatch: profile=${profile.country}, ip=${ipInfo.country}`);
      score -= 40;
    }
    
    // 检查时区
    const validCountriesForTimezone = TIMEZONE_MAPPING[profile.timezone] || [];
    if (!validCountriesForTimezone.includes(ipInfo.country)) {
      inconsistencies.push(`Timezone mismatch: profile=${profile.timezone}, ip_country=${ipInfo.country}`);
      score -= 30;
    }
    
    // 检查语言
    const validCountriesForLanguage = LANGUAGE_MAPPING[profile.language] || [];
    if (!validCountriesForLanguage.includes(ipInfo.country)) {
      inconsistencies.push(`Language mismatch: profile=${profile.language}, ip_country=${ipInfo.country}`);
      score -= 20;
    }
    
    // 检查地区/城市（如果有）
    if (profile.region && ipInfo.region && 
        profile.region.toLowerCase() !== ipInfo.region.toLowerCase()) {
      inconsistencies.push(`Region mismatch: profile=${profile.region}, ip=${ipInfo.region}`);
      score -= 10;
    }
    
    return {
      isConsistent: score >= 80,
      inconsistencies,
      score: Math.max(0, score)
    };
  }
  
  /**
   * 获取随机但一致的地理位置配置
   */
  static getRandomConsistentProfile(): GeoProfile {
    const countryKeys = Object.keys(GEO_PROFILES);
    const randomCountry = countryKeys[Math.floor(Math.random() * countryKeys.length)];
    
    return { ...GEO_PROFILES[randomCountry] };
  }
  
  /**
   * 根据User-Agent推断可能的地理位置
   */
  static inferFromUserAgent(userAgent: string): Partial<GeoProfile> {
    const profile: Partial<GeoProfile> = {};
    
    // 根据语言偏好推断
    if (userAgent.includes('zh-CN')) {
      profile.country = 'CN';
      profile.language = 'zh-CN';
      profile.locale = 'zh-CN';
    } else if (userAgent.includes('ja-JP')) {
      profile.country = 'JP';
      profile.language = 'ja-JP';
      profile.locale = 'ja-JP';
    } else if (userAgent.includes('ko-KR')) {
      profile.country = 'KR';
      profile.language = 'ko-KR';
      profile.locale = 'ko-KR';
    } else if (userAgent.includes('ru-RU')) {
      profile.country = 'RU';
      profile.language = 'ru-RU';
      profile.locale = 'ru-RU';
    } else if (userAgent.includes('en-GB')) {
      profile.country = 'GB';
      profile.language = 'en-GB';
      profile.locale = 'en-GB';
    } else if (userAgent.includes('en-US') || userAgent.includes('en')) {
      profile.country = 'US';
      profile.language = 'en-US';
      profile.locale = 'en-US';
    }
    
    return profile;
  }
  
  /**
   * 获取浏览器的地理位置配置
   */
  static getBrowserConfig(profile: GeoProfile): {
    locale: string;
    timezone: string;
    languages: string[];
    extraHTTPHeaders: Record<string, string>;
  } {
    const config = {
      locale: profile.locale,
      timezone: profile.timezone,
      languages: [profile.language, profile.language.split('-')[0]],
      extraHTTPHeaders: {
        'Accept-Language': `${profile.language},${profile.language.split('-')[0]};q=0.9,en;q=0.8`,
        'CF-IPCountry': profile.country
      }
    };
    
    return config;
  }
}