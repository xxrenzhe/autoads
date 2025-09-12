export function safeGetProperty<T extends object, K extends string>(
  obj: T | null | undefined,
  prop: K,
  defaultValue: any
): any {
  if (!obj) return defaultValue;
  
  const props = prop.split('.');
  let result: any = obj;
  
  for (const p of props) {
    if (result === null || result === undefined) {
      return defaultValue;
    }
    result = result[p];
  }
  
  return result ?? defaultValue;
}
