import { JsonValue } from "@prisma/client/runtime/library";

// 将数据库 JsonValue 安全转换为字符串数组（null/undefined 返回 undefined）
export function toStringArray(value: JsonValue | string | null | undefined): string[] | undefined {
  if (value == null) return undefined;
  try {
    const v = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === 'string') return [v];
    return undefined;
  } catch {
    // 非 JSON 字符串或解析失败时，若为普通字符串则包装为数组
    if (typeof value === 'string') return [value];
    return undefined;
  }
}

// 编码字符串数组为 JsonValue（空数组返回 []，未提供返回 null）
export function fromStringArray(arr: string[] | null | undefined): JsonValue | null {
  if (arr == null) return null;
  return Array.isArray(arr) ? arr : null;
}

// 泛型：确保 JsonValue 为数组，并按需要转换元素
export function ensureJsonArray<T = unknown>(value: JsonValue | null | undefined, map?: (x: unknown) => T): T[] {
  if (value == null) return [] as T[];
  const raw = Array.isArray(value) ? value : [];
  return map ? raw.map(map) : (raw as T[]);
}

