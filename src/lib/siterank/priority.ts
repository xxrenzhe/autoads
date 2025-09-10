import type { PriorityLevel } from './types';

// 计算优先级 - 基于GlobalRank和MonthlyVisits的简洁算法
export const calculatePriority = (
  globalRank: number | null,
  monthlyVisits: string | null,
  allGlobalRanks: (number | null)[] = [],
  allMonthlyVisits: (string | null)[] = [],
): number => {
  // 如果没有有效数据，返回0
  if (!globalRank && !monthlyVisits) return 0;

  // 解析流量数据
  const visitsNumber = parseTrafficToNumber(monthlyVisits || undefined);

  // 获取有效数据用于相对比较
  const validGlobalRanks = allGlobalRanks.filter(r => r !== null && r !== undefined) as number[];
  const validVisitsNumbers = allMonthlyVisits?.filter(Boolean)?.map(v => parseTrafficToNumber(v || undefined)).filter(v => v > 0);

  // 优先使用百分位排名算法
  if (validGlobalRanks.length > 1 || validVisitsNumbers.length > 1) {
    // 计算GlobalRank百分位（越小越好）
    const rankPercentile = globalRank && validGlobalRanks.length > 1 
      ? 1 - validGlobalRanks.filter(r => r <= globalRank).length / validGlobalRanks.length 
      : 0;

    // 计算MonthlyVisits百分位（越大越好）
    const visitsPercentile = visitsNumber > 0 && validVisitsNumbers.length > 1 
      ? validVisitsNumbers.filter(v => v <= visitsNumber).length / validVisitsNumbers.length 
      : 0;

    // 综合得分：GlobalRank 60% + MonthlyVisits 40%
    const score = (rankPercentile * 0.6 + visitsPercentile * 0.4) * 100;
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  // 绝对算法：对数计算
  const rankScore = globalRank ? Math.max(0, 100 - Math.log10(globalRank) * 15) : 0;
  const visitsScore = visitsNumber > 0 ? Math.min(100, Math.log10(visitsNumber) * 20) : 0;

  // 加权平均：GlobalRank 60% + MonthlyVisits 40%
  const totalScore = rankScore * 0.6 + visitsScore * 0.4;
  return Math.round(Math.max(0, Math.min(100, totalScore)));
};

// 兼容旧版本的计算函数（用于向后兼容）
export const calculatePriorityLegacy = (
  rank: number,
  pageRank: number,
  traffic?: string | number,
  allRanks: number[] = [],
  allPageRanks: number[] = [],
  allTraffics: (string | number)[] = [],
): number => {
  if (!rank || !pageRank) return 0;

  // 解析流量数据
  const trafficNumber = parseTrafficToNumber(traffic);

  // 如果有其他数据用于相对比较，使用百分位排名
  if (allRanks.length > 1 && allPageRanks.length > 1) {
    // 计算排名百分位（越小越好，所以用1减去）
    const rankPercentile =
      1 - allRanks.filter((r) => r <= rank).length / allRanks.length;
    const pageRankPercentile =
      allPageRanks.filter((pr) => pr <= pageRank).length /
      allPageRanks.length;

    // 计算流量百分位（越大越好）
    let trafficPercentile = 0;
    if (allTraffics.length > 1 && trafficNumber > 0) {
      const trafficNumbers = allTraffics?.filter(Boolean)?.map(parseTrafficToNumber).filter(t => t > 0);
      if (trafficNumbers.length > 1) {
        trafficPercentile = trafficNumbers.filter((t) => t <= trafficNumber).length / trafficNumbers.length;
      }
    }

    // 综合百分位得分：排名40%，PageRank 30%，流量30%
    const percentileScore = (
      rankPercentile * 0.4 + 
      pageRankPercentile * 0.3 + 
      trafficPercentile * 0.3
    ) * 100;

    // 确保分数在0-100范围内
    return Math.round(Math.max(0, Math.min(100, percentileScore)));
  }

  // 如果没有其他数据，使用绝对算法
  // 全球排名：使用对数计算，对高排名更敏感
  const rankScore = Math.max(0, 100 - Math.log10(rank) * 12);

  // PageRank：线性权重，但增加区分度
  const pageRankScore = Math.min(100, pageRank * 20);

  // 流量得分：使用对数计算，对高流量更敏感
  const trafficScore = trafficNumber > 0 ? Math.min(100, Math.log10(trafficNumber) * 15) : 0;

  // 综合得分：排名权重40%，PageRank权重30%，流量权重30%
  const totalScore = rankScore * 0.4 + pageRankScore * 0.3 + trafficScore * 0.3;

  return Math.round(Math.max(0, Math.min(100, totalScore)));
};

/**
 * 解析流量字符串为数字
 */
function parseTrafficToNumber(traffic?: string | number): number {
  if (!traffic) return 0;
  
  if (typeof traffic === 'number') return traffic;
  
  const str = traffic.toString().toLowerCase();
  
  // 处理 "1.5K", "2.3M" 等格式
  if (str.includes('k')) {
    return parseFloat(str.replace('k', '')) * 1000;
  }
  if (str.includes('m')) {
    return parseFloat(str.replace('m', '')) * 1000000;
  }
  if (str.includes('b')) {
    return parseFloat(str.replace('b', '')) * 1000000000;
  }
  
  // 处理纯数字
  return parseInt(str.replace(/[^\d]/g, '')) || 0;
}

// 获取优先级等级 - 动态划分确保三档分布
export const getPriorityLevel = (
  priority: number,
  allPriorities: number[] = [],
  locale: string = "en"
): PriorityLevel => {
  // 如果有其他优先级数据，使用动态划分
  if (allPriorities.length > 1) {
    const sortedPriorities = [...allPriorities].sort((a, b) => a - b);
    const highThreshold =
      sortedPriorities[Math.floor(sortedPriorities.length * 0.7)]; // 前30%为高
    const mediumThreshold =
      sortedPriorities[Math.floor(sortedPriorities.length * 0.3)]; // 前30%为高，后40%为中

    if (priority >= highThreshold) {
      return {
        level: locale === "zh" ? "高" : "High",
        color: "text-red-700",
        backgroundColor: "bg-red-50",
        borderColor: "border-red-200",
        icon: "🔥",
      };
    }
    if (priority >= mediumThreshold) {
      return {
        level: locale === "zh" ? "中" : "Medium",
        color: "text-yellow-700",
        backgroundColor: "bg-yellow-50",
        borderColor: "border-yellow-200",
        icon: "⚡",
      };
    }
    return {
      level: locale === "zh" ? "低" : "Low",
      color: "text-green-700",
      backgroundColor: "bg-green-50",
      borderColor: "border-green-200",
      icon: "✅",
    };
  }

  // 如果没有其他数据，使用固定阈值
  if (priority >= 70) {
    return {
      level: locale === "zh" ? "高" : "High",
      color: "text-red-700",
      backgroundColor: "bg-red-50",
      borderColor: "border-red-200",
      icon: "🔥",
    };
  }
  if (priority >= 40) {
    return {
      level: locale === "zh" ? "中" : "Medium",
      color: "text-yellow-700",
      backgroundColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      icon: "⚡",
    };
  }
  return {
    level: locale === "zh" ? "低" : "Low",
    color: "text-green-700",
    backgroundColor: "bg-green-50",
    borderColor: "border-green-200",
    icon: "✅",
  };
};