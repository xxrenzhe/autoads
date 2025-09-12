// 列标签映射
export const COLUMN_LABELS: Record<string, Record<string, string>> = {
  MID: { zh: "MID", en: "MID" },
  "Merchant Name": { zh: "商家名称", en: "Merchant Name" },
  Country: { zh: "国家", en: "Country" },
  Category: { zh: "类别", en: "Category" },
  "Advert Url": { zh: "广告URL", en: "Advert Url" },
  RD: { zh: "竞争度", en: "RD" },
  Commission: { zh: "佣金比例", en: "Commission" },
  "Application time": { zh: "申请时间", en: "Application time" },
  Link: { zh: "联盟广告链接", en: "Link" },
  domain: { zh: "域名", en: "Domain" },
  域名: { zh: "域名", en: "Domain" },
  Domain: { zh: "域名", en: "Domain" },
  rank: { zh: "全球排名", en: "Global Rank" },
  全球排名: { zh: "全球排名", en: "Global Rank" },
  "Global Rank": { zh: "全球排名", en: "Global Rank" },
  GlobalRank: { zh: "全球排名", en: "Global Rank" },
  pageRank: { zh: "相对排名", en: "PageRank" },
  相对排名: { zh: "相对排名", en: "PageRank" },
  PageRank: { zh: "相对排名", en: "PageRank" },
  MonthlyVisits: { zh: "月访问量", en: "Monthly Visits" },
  "Monthly Visits": { zh: "月访问量", en: "Monthly Visits" },
  priority: { zh: "测试优先级", en: "Test Priority" },
  测试优先级: { zh: "测试优先级", en: "Test Priority" },
  "Test Priority": { zh: "测试优先级", en: "Test Priority" },
  traffic: { zh: "流量", en: "Traffic" },
  流量: { zh: "流量", en: "Traffic" },
  网站流量: { zh: "网站流量", en: "Website Traffic" },
  organicTraffic: { zh: "自然流量", en: "Organic Traffic" },
  paidTraffic: { zh: "付费流量", en: "Paid Traffic" },
  trafficValue: { zh: "流量价值", en: "Traffic Value" },
  status: { zh: "状态", en: "Status" },
  状态: { zh: "状态", en: "Status" },
};

// 获取列显示名称
export const getColumnDisplayName = (col: string, locale: string = "en") => {
  return COLUMN_LABELS[col]?.[locale] || col;
};

// 获取列宽度
export const getColumnWidth = (col: string) => {
  const widths: Record<string, string> = {
    MID: "w-16",
    "Merchant Name": "w-40",
    Country: "w-16",
    Category: "w-20",
    "Advert Url": "w-24",
    RD: "w-12",
    Commission: "w-16",
    "Application time": "w-24",
    Link: "w-24",
    domain: "w-36",
    域名: "w-36",
    rank: "w-20",
    全球排名: "w-20",
    GlobalRank: "w-20",
    pageRank: "w-16",
    相对排名: "w-16",
    MonthlyVisits: "w-20",
    priority: "w-24",
    测试优先级: "w-24",
    commission: "w-16",
    佣金: "w-16",
    traffic: "w-16",
    流量: "w-16",
    网站流量: "w-20",
    organicTraffic: "w-20",
    paidTraffic: "w-20",
    trafficValue: "w-20",
    status: "w-16",
    状态: "w-16",
  };
  return widths[col] || "w-auto";
};

// 获取列样式类
export const getColumnClass = (col: string) => {
  if (col === "domain" || col === "域名") {
    return "font-medium text-blue-600 hover:text-blue-800";
  }
  return "";
};

// 获取排序值
export const getSortValue = (
  row: Record<string, string | number | null | undefined>,
  col: string,
) => {
  const value = row[col];

  if (col === "测试优先级" || col === "priority") {
    return typeof value === "number" ? value : 0;
  }

  if (col === "全球排名" || col === "rank" || col === "GlobalRank") {
    return typeof value === "number" ? value : Number.MAX_SAFE_INTEGER;
  }

  if (col === "相对排名" || col === "pageRank") {
    return typeof value === "number" ? value : 0;
  }

  if (col === "MonthlyVisits") {
    if (typeof value === "string") {
      // 解析流量格式 "1.5K", "2.3M" 等
      const str = value.toLowerCase();
      if (str.includes('k')) {
        return parseFloat(str.replace('k', '')) * 1000;
      }
      if (str.includes('m')) {
        return parseFloat(str.replace('m', '')) * 1000000;
      }
      if (str.includes('b')) {
        return parseFloat(str.replace('b', '')) * 1000000000;
      }
      return parseInt(str.replace(/[^\d]/g, '')) || 0;
    }
    return typeof value === "number" ? value : 0;
  }

  if (col === "佣金" || col === "Commission") {
    if (typeof value === "string") {
      const numValue = Number.parseFloat(value.replace("%", ""));
      return Number.isNaN(numValue) ? 0 : numValue;
    }
    return typeof value === "number" ? value : 0;
  }

  if (col === "网站流量" || col === "traffic" || col === "流量") {
    if (typeof value === "string") {
      // 解析流量格式 "1.5K", "2.3M" 等
      const str = value.toLowerCase();
      if (str.includes('k')) {
        return parseFloat(str.replace('k', '')) * 1000;
      }
      if (str.includes('m')) {
        return parseFloat(str.replace('m', '')) * 1000000;
      }
      if (str.includes('b')) {
        return parseFloat(str.replace('b', '')) * 1000000000;
      }
      return parseInt(str.replace(/[^\d]/g, '')) || 0;
    }
    return typeof value === "number" ? value : 0;
  }

  return value;
};