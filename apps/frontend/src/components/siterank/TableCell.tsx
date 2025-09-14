import React from 'react';
import type { AnalysisResult } from '@/lib/siterank/types';
import { getPriorityLevel } from '@/lib/siterank/priority';
import React from 'react';

interface TableCellProps {
  row: AnalysisResult;
  col: string;
  locale: string;
  allPriorities: number[];
}

const TableCellBase: React.FC<TableCellProps> = ({ row, col, locale, allPriorities }) => {
  const value = row[col];

  if (col === "全球排名" || col === "rank" || col === "GlobalRank") {
    if (value === "loading") {
      return (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
        </div>
      );
    }
    if (value === null || value === undefined) {
      return (
        <span
          className="text-gray-500"
          title={"暂无数据"}
        >
          -
        </span>
      );
    }
    if (typeof value === "number") {
      return (
        <a
          href={`https://data.similarweb.com/api/v1/data?domain=${encodeURIComponent(row.domain ?? "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {value.toLocaleString()}
        </a>
      );
    }
    return value;
  }

  if (col === "相对排名" || col === "pageRank") {
    if (value === "loading") {
      return (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
        </div>
      );
    }
    if (value === null || value === undefined) {
      return (
        <span
          className="text-red-500"
          title={"查询超时或失败"}
        >
          -
        </span>
      );
    }
    if (typeof value === "number") {
      return (
        <a
          href={`https://www.domcop.com/openpagerank/?domain=${encodeURIComponent(row.domain ?? "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {Math.round(value)}
        </a>
      );
    }
    return value;
  }

  if (col === "测试优先级" || col === "priority") {
    if (value === "loading") {
      return (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
        </div>
      );
    }
    if (value === null || value === undefined) {
      return (
        <span
          className="text-gray-500"
          title={"暂无数据"}
        >
          -
        </span>
      );
    }
    if (typeof value === "number") {
      const { level, color, borderColor, icon } = getPriorityLevel(
        value,
        allPriorities,
        locale
      );
      return (
        <div
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold border ${color} ${color} ${borderColor} shadow-sm`}
        >
          <span className="text-base">{icon}</span>
          <span>{level}</span>
          <span className="text-sm opacity-75">({value})</span>
        </div>
      );
    }
    return value;
  }

  // MonthlyVisits 列
  if (col === "MonthlyVisits") {
    if (value === "loading") {
      return (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
        </div>
      );
    }
    if (value === null || value === undefined) {
      return (
        <span
          className="text-gray-500"
          title={"暂无数据"}
        >
          -
        </span>
      );
    }
    if (typeof value === "string") {
      return (
        <a
          href={`https://data.similarweb.com/api/v1/data?domain=${encodeURIComponent(row.domain ?? "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline font-medium"
        >
          {value}
        </a>
      );
    }
    return value;
  }

  // 网站流量列（兼容旧版本）
  if (col === 'traffic') {
    if (value === "loading") {
      return (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    const trafficValue = value as string;
    if (!trafficValue || trafficValue === 'N/A') {
      return <span className="text-gray-400">-</span>;
    }

    // 解析流量数值和置信度
    const trafficData = row.original as any;
    const confidence = trafficData.confidence || 0;
    const source = trafficData.source || 'unknown';
    const domain = trafficData.domain || trafficData.域名 || '';
    
    // 置信度颜色指示器
    const getConfidenceColor = (conf: number) => {
      if (conf >= 0.8) return 'text-green-600';
      if (conf >= 0.6) return 'text-yellow-600';
      return 'text-red-600';
    };

    const getConfidenceIcon = (conf: number) => {
      if (conf >= 0.8) return '🟢';
      if (conf >= 0.6) return '🟡';
      return '🔴';
    };

    // 格式化流量显示
    const formatTrafficDisplay = (traffic: string) => {
      if (traffic.includes('K')) {
        const num = parseFloat(traffic.replace('K', ''));
        if (num >= 1000) {
          return `${(num / 1000).toFixed(1)}M`;
        }
      }
      return traffic;
    };

    return (
      <div className="flex flex-col space-y-1">
        <div className="flex items-center space-x-2">
          <a
            href={`https://ahrefs.com/zh/traffic-checker/?input=${encodeURIComponent(domain)}&mode=subdomains`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline font-medium"
          >
            {formatTrafficDisplay(trafficValue)}
          </a>
          <span className={`text-xs ${getConfidenceColor(confidence)}`}>
            {getConfidenceIcon(confidence)}
          </span>
        </div>
        <div className="text-xs text-gray-500">
          <span className="font-medium">置信度:</span> {(confidence * 100).toFixed(0)}%
          {source !== 'known-data' && (
            <span className="ml-2 text-gray-400">
              ({source.split(',').slice(0, 2).join(', ')})
            </span>
          )}
        </div>
      </div>
    );
  }

  if (col === "domain" || col === "域名") {
    return (
      <a
        href={`https://${value}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-blue-600 hover:text-blue-800 underline"
        title={value == null ? "" : String(value)}
      >
        {value}
      </a>
    );
  }

  if (col === "Advert Url") {
    const str = value == null ? "" : String(value);
    const truncatedStr = str.length > 12 ? `${str.slice(0, 12)}...` : str;
    return (
      <span 
        title={str} 
        className="cursor-help whitespace-nowrap text-sm"
      >
        {truncatedStr}
      </span>
    );
  }

  if (col === "Link") {
    if (typeof value === "string") {
      const displayText = value.length > 12 ? `${value.substring(0, 12)}...` : value;
      return (
        <a
          href={value.startsWith("http") ? value : `https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline whitespace-nowrap text-sm"
          title={value}
        >
          {displayText}
        </a>
      );
    }
    return value;
  }

  if (col === "申请时间" || col === "Application time") {
    const str = value == null ? "" : String(value);
    const dateOnly = str.split(' ')[0] || str;
    return (
      <span 
        className="whitespace-nowrap text-sm" 
        title={str}
      >
        {dateOnly}
      </span>
    );
  }

  if (col === "MID") {
    return (
      <span className="whitespace-nowrap text-sm font-mono">
        {value}
      </span>
    );
  }

  if (col === "RD") {
    return (
      <span className="whitespace-nowrap text-sm text-center">
        {value}
      </span>
    );
  }

  if (col === "Commission" || col === "佣金") {
    return (
      <span className="whitespace-nowrap text-sm font-semibold text-green-600">
        {value}
      </span>
    );
  }

  // 特殊处理需要字符限制的列
  if (col === "Merchant Name" || col === "商家名称") {
    const str = value == null ? "" : String(value);
    const truncatedStr = str.length > 20 ? `${str.slice(0, 20)}...` : str;
    return (
      <span 
        className="whitespace-nowrap cursor-help text-sm font-medium" 
        title={str}
      >
        {truncatedStr}
      </span>
    );
  }

  if (col === "Country" || col === "国家") {
    const str = value == null ? "" : String(value);
    const truncatedStr = str.length > 8 ? `${str.slice(0, 8)}...` : str;
    return (
      <span 
        className="whitespace-nowrap cursor-help text-sm" 
        title={str}
      >
        {truncatedStr}
      </span>
    );
  }

  if (col === "Category" || col === "类别") {
    const str = value == null ? "" : String(value);
    const truncatedStr = str.length > 12 ? `${str.slice(0, 12)}...` : str;
    return (
      <span 
        className="whitespace-nowrap cursor-help text-sm" 
        title={str}
      >
        {truncatedStr}
      </span>
    );
  }

  // 其他常规字段都加上单行显示
  const singleLineCols = [
    "RD",
    "Commission",
    "佣金",
    "MID",
  ];
  if (singleLineCols.includes(col)) {
    return <span className="whitespace-nowrap">{value}</span>;
  }

  // 统一截断显示（超链接和特殊列除外）
  const skipTruncateCols = [
    "全球排名",
    "rank",
    "GlobalRank",
    "相对排名",
    "pageRank",
    "MonthlyVisits",
    "测试优先级",
    "priority",
    "domain",
    "域名",
    "Advert Url",
    "Link",
    "Application time",
    "申请时间",
    "Merchant Name",
    "商家名称",
    "Country",
    "国家",
    "Category",
    "类别",
    "MID",
    "RD",
    "Commission",
    "佣金",
  ];
  if (!skipTruncateCols.includes(col)) {
    const str = value == null ? "" : String(value);
    return (
      <span
        className="whitespace-nowrap text-sm"
        title={str}
        style={{
          maxWidth: 120,
          display: "inline-block",
          overflow: "hidden",
          textOverflow: "ellipsis",
          verticalAlign: "bottom",
        }}
      >
        {str.length > 15 ? `${str.slice(0, 15)}...` : str}
      </span>
    );
  }
  return value;
};

// 避免无关重渲染：当目标单元格值与关键参数未变动时跳过
export const TableCell = React.memo(TableCellBase, (prev, next) => {
  if (prev.col !== next.col) return false;
  if (prev.locale !== next.locale) return false;
  const prevVal = (prev.row as any)[prev.col];
  const nextVal = (next.row as any)[next.col];
  if (prevVal !== nextVal) return false;
  // 对优先级列，比较 allPriorities 快照
  if ((prev.col === '测试优先级' || prev.col === 'priority')) {
    if (prev.allPriorities.length !== next.allPriorities.length) return false;
    for (let i = 0; i < prev.allPriorities.length; i++) {
      if (prev.allPriorities[i] !== next.allPriorities[i]) return false;
    }
  }
  return true;
});
