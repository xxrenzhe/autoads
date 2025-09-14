export interface SimilarWebData {
  domain: string;
  globalRank: number | null;
  monthlyVisits: string | null;
  status: 'loading' | 'success' | 'error';
  error?: string;
  timestamp: Date;
  source: 'similarweb-api';
  apiEndpoint?: string;
  responseTime?: number;
  retries?: number;
}

export interface TrafficData {
  domain: string;
  traffic: string;
  organicTraffic?: string;
  paidTraffic?: string;
  trafficValue?: string;
  status: 'loading' | 'success' | 'error';
  error?: string;
  timestamp: Date;
  source?: string;
  confidence?: number;
}

export interface SiteRankResponse {
  success: boolean;
  data?: SimilarWebData | TrafficData;
  type?: string;
  error?: string;
  details?: string;
}

export interface AnalysisResult {
  domain?: string;
  域名?: string;
  fromCache?: boolean;
  rank?: number | null;
  全球排名?: number | null | "loading";
  相对排名?: number | null | "loading";
  GlobalRank?: number | null | "loading";
  MonthlyVisits?: string | null | "loading";
  测试优先级?: number | null | "loading";
  priority?: number;
  commission?: string;
  traffic?: string;
  网站流量?: string | "loading";
  organicTraffic?: string;
  paidTraffic?: string;
  trafficValue?: string;
  status?: string;
  originalUrl?: string;
  [key: string]: string | number | null | undefined | "loading"; // 允许动态属性
}

export interface PriorityLevel {
  level: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  icon: string;
}

export const DOMAIN_HEADER_CANDIDATES = [
  "Advert Url",
  "Advert URL",
  "Website Link",
  "Website Url",
  "Url",
  "URL",
  "Domain",
  "域名",
  "网址",
  "链接",
];

export const OPENPAGERANK_API_KEY = process.env.OPENPAGERANK_API_KEY;
