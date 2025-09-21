/**
 * 访问次数计算工具
 * 用于预计算随机化模式下的总访问次数
 */

/**
 * 预计算总访问次数
 * @param urls URL列表
 * @param cycleCount 轮次数
 * @returns 预计算的总访问次数
 */
export function preCalculateTotalVisits(
  urls: string[],
  cycleCount: number
): number {
  // 每个URL每轮访问1次
  return urls.length * cycleCount;
}

/**
 * 计算单轮中每个URL的访问次数
 * @param urls URL列表
 * @returns 每个URL的访问次数数组
 */
export function calculateUrlVisitsForRound(
  urls: string[]
): number[] {
  // 每个URL访问1次
  return urls.map(() => 1);
}
