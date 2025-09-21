import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, Search, Download } from "lucide-react";
import { TableCell } from './TableCell';
import type { AnalysisResult } from '@/lib/siterank/types';
import { getColumnWidth, getColumnClass, getColumnDisplayName, getSortValue } from '@/lib/siterank/table';
import ExcelJS from "exceljs";
import { getPriorityLevel } from '@/lib/siterank/priority';

interface ResultsTableProps {
  results: AnalysisResult[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  displayColumns: string[];
  locale: string;
  t: (key: string) => string | string[];
  hasQueried: boolean;
  isBackgroundQuerying: boolean;
  progressText: string;
}

// 辅助函数：确保翻译函数返回字符串
const getTStr = (t: (key: string) => string | string[], key: string): string => {
  const result = t(key);
  return Array.isArray(result) ? result[0] || "" : result || "";
};

export const ResultsTable: React.FC<ResultsTableProps> = ({
  results,
  searchTerm,
  onSearchChange,
  sortField,
  sortDirection,
  onSort,
  displayColumns,
  locale,
  t,
  hasQueried,
  isBackgroundQuerying,
  progressText
}) => {
  // 预计算所有优先级（供子单元格复用）
  const allPriorities = useMemo(() => {
    return results
      .map((r: any) => r.测试优先级)
      .filter((p: unknown): p is number => typeof p === 'number');
  }, [results]);

  // 过滤搜索结果（memo，避免重复计算）
  const filteredResults = useMemo(() => results.filter((result: any) => {
    const domain = result.domain || result.域名;
    return (
      domain &&
      typeof domain === "string" &&
      domain.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }), [results, searchTerm]);

  // 排序结果（memo）
  const sortedResults = useMemo(() => [...filteredResults].sort((a, b) => {
    let aValue = getSortValue(a, sortField);
    let bValue = getSortValue(b, sortField);

    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    if (typeof aValue === "string" && typeof bValue === "string") {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (
      (typeof aValue === "string" || typeof aValue === "number") &&
      (typeof bValue === "string" || typeof bValue === "number")
    ) {
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    }
    return 0;
  }), [filteredResults, sortField, sortDirection]);

  // 导出Excel
  const exportToExcel = async () => {
    try {
        if (!results.length) return;
    
        const headers = Object.keys(results[0]).filter(
          (key) => !["originalUrl"].includes(key),
        );
    
        const exportData = results.map((row: any) => {
          const exportRow: Record<string, string | number | null | undefined> = {};
          for (const header of headers) {
            const value = row[header];
            if (header === "测试优先级" && typeof value === "number") {
              const { level } = getPriorityLevel(value, [], locale);
              exportRow[getColumnDisplayName(header, locale)] = level;
            } else {
              exportRow[getColumnDisplayName(header, locale)] = value;
            }
          }
          return exportRow;
        });
    
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("分析结果");
        worksheet.columns = Object.keys(exportData[0]).map((key: any) => ({ header: key, key }));
        exportData.forEach((row: any) => worksheet.addRow(row));
    
        // 自动宽度
        worksheet.columns.forEach((column: any) => {
          let maxLength = 10;
          column.eachCell?.({ includeEmpty: true }, (cell) => { 
            const len = cell.value ? cell.value.toString().length : 0;
            if (len > maxLength) maxLength = len; 
          });
          column.width = maxLength + 2;
        });
    
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${"分析结果"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert("导出失败");
    }
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{Array.isArray(t("siterank.resultsTitle")) ? t("siterank.resultsTitle")[0] : t("siterank.resultsTitle")}</span>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm text-gray-500">
              {sortedResults.length} {"条结果"}
            </span>
            {isBackgroundQuerying && progressText && (
              <span className="text-sm text-blue-600 font-medium">
                {progressText}
              </span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 测试优先级算法说明 */}
        {hasQueried && (
          <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="text-sm font-medium text-gray-800 mb-2">
              {"测试优先级算法"}
            </h4>
            <div className="text-xs text-gray-600">
              <p className="mb-2">
                基于SimilarWeb数据计算：GlobalRank(60%) + MonthlyVisits(40%)
              </p>
              <p className="text-gray-500">
                数据来源：SimilarWeb API | 7天缓存 | 自动分档
              </p>
            </div>
          </div>
        )}
        
        <div className="flex justify-between items-center mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder={"搜索域名..."}
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          {hasQueried && (
            <Button
              onClick={exportToExcel}
              variant="outline"
              size="sm"
              className="ml-4"
            >
              <Download className="h-4 w-4 mr-2" />
              {"导出Excel"}
            </Button>
          )}
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full border-collapse bg-white">
            <thead className="bg-slate-50">
              <tr>
                {displayColumns.map((col) => (
                  <th
                    key={col}
                    className={`py-3 px-4 text-left text-sm font-semibold text-slate-700 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors ${sortField === col ? "bg-blue-50" : ""} ${getColumnWidth(col)} ${getColumnClass(col)}`}
                    onClick={() => onSort(col)}
                  >
                    <div className="flex items-center justify-between">
                      <span>{getColumnDisplayName(col, locale)}</span>
                      {sortField === col && (
                        <span className="ml-1">
                          {sortDirection === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((row, index: number) => (
                <tr
                  key={`${row.domain || row.域名}-${index}`}
                  className="hover:bg-slate-50 transition-colors"
                >
                  {displayColumns.map((col) => (
                    <td
                      key={col}
                      className={`py-2 px-4 align-middle text-[15px] ${getColumnClass(col)} border-r border-gray-100 last:border-r-0`}
                    >
                      <TableCell 
                        row={row}
                        col={col}
                        locale={locale}
                        allPriorities={allPriorities}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedResults.length === 0 && hasQueried && (
          <div className="text-center py-8 text-gray-500">
            {"没有找到匹配的结果"}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
