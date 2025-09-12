/**
 * Simplified timezone utilities for AutoClick system
 * 使用固定UTC-8偏移，简化时区处理
 */

/**
 * 获取UTC-8时区的当前小时（0-23）
 */
export function getPSTHour(date: Date = new Date()): number {
  const utcDate = new Date(date.toUTCString());
  let pstHour = utcDate.getUTCHours() - 8; // 固定UTC-8偏移
  
  // 处理跨天情况
  if (pstHour < 0) pstHour += 24;
  if (pstHour >= 24) pstHour -= 24;
  
  return pstHour;
}

/**
 * 获取UTC-8时区的当前日期（YYYY-MM-DD格式）
 */
export function getPSTDate(date: Date = new Date()): string {
  const utcDate = new Date(date.toUTCString());
  let pstDate = new Date(utcDate.getTime() - 8 * 60 * 60 * 1000); // 固定UTC-8偏移
  
  // 处理跨天情况
  if (utcDate.getUTCHours() < 8) {
    pstDate = new Date(utcDate.getTime() - 8 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
  }
  
  return pstDate.toISOString().split('T')[0];
}

/**
 * 将UTC时间转换为UTC-8时间
 */
export function utcToPST(utcDate: Date): Date {
  return new Date(utcDate.getTime() - 8 * 60 * 60 * 1000);
}

/**
 * 检查当前时间是否在执行窗口内
 */
export function isInExecutionWindow(timeWindow: string, date: Date = new Date()): boolean {
  const pstHour = getPSTHour(date);
  
  switch (timeWindow) {
    case '00:00-24:00':
      return true; // 全天
    case '06:00-24:00':
      return pstHour >= 6 && pstHour < 24;
    default:
      return false;
  }
}

/**
 * 获取执行窗口的小时数组
 */
export function getExecutionWindowHours(timeWindow: string): number[] {
  switch (timeWindow) {
    case '00:00-24:00':
      return Array.from({ length: 24 }, (_, i) => i);
    case '06:00-24:00':
      return Array.from({ length: 18 }, (_, i) => i + 6);
    default:
      return [];
  }
}

/**
 * 格式化UTC-8时间显示
 */
export function formatPSTTime(date: Date): string {
  const pstDate = utcToPST(date);
  
  return pstDate.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }) + ' (PST)';
}

// 保持兼容性的导出
export function isUSDaylightSavingTime(date: Date): boolean {
  // 简化版本，始终返回false
  return false;
}