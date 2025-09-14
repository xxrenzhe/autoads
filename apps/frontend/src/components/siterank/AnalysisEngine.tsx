import { useCallback, useMemo, useState, useRef } from 'react';
import type { AnalysisResult } from '@/lib/siterank/types';
import { calculatePriority } from '@/lib/siterank/priority';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
import { validateBatchQueryCount } from '@/lib/config/siterank';
import { backend } from '@/shared/http/backend';
const logger = createClientLogger('AnalysisEngine');

interface AnalysisEngineProps {
  domains: string[];
  originalData: Record<string, string | number | null | undefined>[];
  locale: string;
  onResultsUpdate: (results: AnalysisResult[] | ((prev: AnalysisResult[]) => AnalysisResult[])) => void;
  onProgressUpdate: (text: string) => void;
  onStatusUpdate: (analyzing: boolean, backgroundQuerying: boolean) => void;
}

// 请求队列接口
interface QueuedRequest {
  domain: string;
  resolve: (result: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

// 速率限制状态接口
interface RateLimitStatus {
  remaining: number;
  resetTime: number;
  totalRequests: number;
  isLimited: boolean;
}

export const useAnalysisEngine = ({
  domains,
  originalData,
  locale,
  onResultsUpdate,
  onProgressUpdate,
  onStatusUpdate,
}: AnalysisEngineProps) => {
  // 速率限制状态
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus>({
    remaining: 500,
    resetTime: 0,
    totalRequests: 0,
    isLimited: false
  });
  
  // 请求队列
  const requestQueue = useRef<QueuedRequest[]>([]);
  const isProcessingQueue = useRef(false);
  const abortController = useRef<AbortController | null>(null);
  
  // 去重域名列表，避免重复查询
  const uniqueDomains = useMemo(() => {
    const domainSet = new Set<string>();
    const uniqueList: string[] = [];
    
    domains.forEach((domain: any) => {
      if (!domainSet.has(domain)) {
        domainSet.add(domain);
        uniqueList.push(domain);
      }
    });
    
    logger.info(`域名去重: ${domains.length} -> ${uniqueList.length}`);
    return uniqueList;
  }, [domains]);
  
  // 处理请求队列
  const processRequestQueue = useCallback(async () => {
    if (isProcessingQueue.current || requestQueue.current.length === 0) {
      return;
    }

    isProcessingQueue.current = true;

    while (requestQueue.current.length > 0) {
      const request = requestQueue.current.shift()!;
      
      try {
        // 检查速率限制状态
        if (rateLimitStatus.remaining <= 10) {
          // 等待速率限制重置
          const waitTime = Math.max(0, rateLimitStatus.resetTime - Date.now());
          if (waitTime > 0) {
            await sleep(waitTime);
            // 重新获取速率限制状态
            continue;
          }
        }

        // 执行请求
        const result = await executeDomainRequest(request.domain);
        request.resolve(result);
        
        // 更新速率限制状态（使用服务器返回的准确信息）
        if (result.rateLimitInfo) {
          setRateLimitStatus(prev => ({
            ...prev,
            remaining: result.rateLimitInfo.remaining,
            totalRequests: result.rateLimitInfo.totalRequests,
            isLimited: result.rateLimitInfo.remaining === 0
          }));
        } else if (result.fromCache !== true) {
          // 如果没有返回 rateLimitInfo 且不是缓存，则手动减少
          setRateLimitStatus(prev => ({
            ...prev,
            remaining: Math.max(0, prev.remaining - 1),
            totalRequests: prev.totalRequests + 1
          }));
        }
        
        if (result.fromCache) {
          logger.info(`缓存命中: ${request.domain}`);
        }

        // 根据剩余配额调整延迟
        if (rateLimitStatus.remaining < 50) {
          await sleep(100); // 低配额时增加延迟
        } else if (rateLimitStatus.remaining < 100) {
          await sleep(50);  // 中等配额时适度延迟
        }
        
      } catch (error) {
        request.reject(error);
      }
    }

    isProcessingQueue.current = false;
  }, [rateLimitStatus]);

  // 执行单个域名请求
  const executeDomainRequest = useCallback(async (domain: string) => {
    const controller = new AbortController();
    abortController.current = controller;
    
    try {
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      // 通过 Next 内置反代访问 Go 后端
      const result = await backend.get<any>(
        '/api/siterank/rank',
        { domain, source: 'similarweb' }
      );
      
      clearTimeout(timeoutId);
      
      // 兼容多种响应结构（Next 内部API / Go 后端）
      if (result?.success && result?.data) {
        return {
          domain,
          globalRank: result.data.globalRank ?? result.data.global_rank ?? null,
          monthlyVisits: result.data.monthlyVisits ?? result.data.monthly_visits ?? null,
          fromCache: result.fromCache || false,
          rateLimitInfo: result.rateLimitInfo
        };
      }
      if (typeof result === 'object' && result) {
        return {
          domain,
          globalRank: result.globalRank ?? result.global_rank ?? null,
          monthlyVisits: result.monthlyVisits ?? result.monthly_visits ?? null,
          fromCache: result.fromCache || false,
          rateLimitInfo: result.rateLimitInfo
        };
      }
      throw new Error('Invalid response format');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }, [rateLimitStatus]);

  // 添加请求到队列
  const queueRequest = useCallback((domain: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      requestQueue.current.push({
        domain,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      // 触发队列处理
      processRequestQueue();
    });
  }, [processRequestQueue]);

  const startAnalysis = useCallback(async () => {
    onStatusUpdate(true, false);

    try {
      if (domains.length === 0) {
        throw new Error("请输入URL或上传文件");
      }

      // 验证域名数量是否超过限制
      const validation = validateBatchQueryCount(domains);
      if (!validation.valid) {
        throw new Error(validation.error || "域名数量超过限制");
      }

      // 重置速率限制状态
      setRateLimitStatus({
        remaining: 500,
        resetTime: 0,
        totalRequests: 0,
        isLimited: false
      });

      // 立即创建初始结果并显示，包含所有原始数据
      const initialResults: AnalysisResult[] = domains.map((domain, index: any) => {
        // 找到对应的原始数据行 - 通过extractedDomain字段匹配
        const originalRow = originalData.find((row: any) => row.extractedDomain === domain) || originalData[index] || {};
        
        logger.info(`Creating initial result ${index}: domain="${domain}", originalData:`, originalRow);
        
        return {
          domain,
          域名: domain,
          originalUrl: String(originalRow?.["Advert Url"] ?? originalRow?.originalUrl ?? domain),
          // 保留所有原始列数据，但排除extractedDomain字段
          ...Object.fromEntries(
            Object.entries(originalRow).filter(([key]: any) => key !== 'extractedDomain')
          ),
          // 排名数据初始化为加载状态
          GlobalRank: "loading",
          MonthlyVisits: "loading",
          测试优先级: "loading"
        };
      });
      onResultsUpdate(initialResults);
      onStatusUpdate(false, true); // 立即完成分析，开始后台查询

      // 存储所有查询结果用于重新计算优先级
      const allResults: Array<{
        domain: string;
        globalRank: number | null;
        monthlyVisits: string | null;
      }> = [];

      // 创建域名到原始索引的映射，用于更新重复域名
      const domainToIndices = new Map<string, number[]>();
      domains.forEach((domain, index: any) => {
        if (!domainToIndices.has(domain)) {
          domainToIndices.set(domain, []);
        }
        domainToIndices.get(domain)!.push(index);
      });
      
      logger.info('Domain to indices mapping:', Object.fromEntries(domainToIndices));

      // 智能分批查询，提高分析速率 - 使用去重后的域名列表
      let batchSize = 20; // 提高初始批次大小
      let consecutiveErrors = 0; // 连续错误计数
      const maxConsecutiveErrors = 3; // 最大连续错误数

      for (let i = 0; i < uniqueDomains.length; i += batchSize) {
        const batch = uniqueDomains.slice(i, i + batchSize);
        const batchPromises = batch?.filter(Boolean)?.map(async (domain, batchIndex) => {
          const globalIndex = i + batchIndex;
          onProgressUpdate(`${globalIndex + 1}/${uniqueDomains.length}`); // 实时更新进度
          
          // 确保无论成功还是失败，都会更新对应域名的状态（包括所有重复域名）
          const updateDomainResult = (similarWebData: { globalRank?: number | null; monthlyVisits?: string | null } | null) => {
            onResultsUpdate((prev) => {
              const newResults = [...prev];
              const indices = domainToIndices.get(domain) || [];
              
              if (indices.length === 0) {
                logger.warn(`Could not find indices for domain: ${domain}`);
                return newResults;
              }
              
              const hasValidData = similarWebData && (
                (similarWebData.globalRank !== null && similarWebData.globalRank !== undefined) ||
                (similarWebData.monthlyVisits !== null && similarWebData.monthlyVisits !== undefined)
              );
              
              // 更新所有相同域名的记录
              indices.forEach((index: any) => {
                if (index < newResults.length) {
                  newResults[index] = {
                    ...newResults[index],
                    GlobalRank: similarWebData?.globalRank ?? null,
                    MonthlyVisits: similarWebData?.monthlyVisits ?? null,
                    测试优先级: hasValidData ? null : null, // 先设为null，稍后重新计算
                  };
                  logger.info(`Updated row ${index} for ${domain} (found ${indices.length} occurrences)`); // 调试日志
                }
              });
              
              return newResults;
            });
          };
          
          try {
            // 使用队列系统发送请求
            const similarWebData = await queueRequest(domain);
            
            logger.info(`SimilarWeb API response for ${domain}:`, new EnhancedError(`SimilarWeb API response for ${domain}`, { 
              result: JSON.stringify(similarWebData, null, 2)
            }));

            // 处理 SimilarWeb API 响应
            if (similarWebData.globalRank !== undefined || similarWebData.monthlyVisits !== undefined) {
              const globalRank = similarWebData.globalRank;
              const monthlyVisits = similarWebData.monthlyVisits;
              
              logger.info(`Processing SimilarWeb response for ${domain}: globalRank=${globalRank}, monthlyVisits=${monthlyVisits}`);
              
              // 使用 SimilarWeb 数据（可能为 null）
              allResults.push({
                domain,
                globalRank: globalRank,
                monthlyVisits: monthlyVisits
              });
              logger.info(`Added to allResults: ${domain} with globalRank=${globalRank}, monthlyVisits=${monthlyVisits}`);

              // 更新结果
              updateDomainResult({ globalRank: globalRank, monthlyVisits: monthlyVisits });
              consecutiveErrors = 0; // 重置错误计数
              return { success: true, domain };
            } else {
              logger.warn(`SimilarWeb API returned invalid response for ${domain}:`, { data: similarWebData });
              updateDomainResult(null); // 无效数据时更新为null
              // 不增加连续错误计数，因为这不是网络错误
              return { success: false, domain, error: "invalid_response" };
            }
          } catch (error) {
            // 检查是否为超时错误
            const isTimeout = error instanceof Error && error.message === 'Request timeout';
            logger.error(`${isTimeout ? 'Timeout' : 'Network'} error for ${domain}: ${error instanceof Error ? error.message : String(error)}`);
            
            updateDomainResult(null); // 失败时更新为null
            
            consecutiveErrors++;
            return {
              success: false,
              domain,
              error: isTimeout ? 'timeout' : (error instanceof Error ? error.message : String(error))
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        // 批处理完成后立即检查是否有遗漏的加载状态
        onResultsUpdate((prev) => {
          const newResults = [...prev];
          let hasUpdates = false;
          
          for (const domain of batch) {
            const indices = domainToIndices.get(domain) || [];
            
            indices.forEach((index: any) => {
              if (index < newResults.length) {
                const result = newResults[index];
                if (result.GlobalRank === "loading" || result.MonthlyVisits === "loading" || result.测试优先级 === "loading") {
                  newResults[index] = {
                    ...result,
                    GlobalRank: result.GlobalRank === "loading" ? null : result.GlobalRank,
                    MonthlyVisits: result.MonthlyVisits === "loading" ? null : result.MonthlyVisits,
                    测试优先级: result.测试优先级 === "loading" ? null : result.测试优先级
                  };
                  hasUpdates = true;
                  logger.info(`Batch cleanup: Updated ${domain} (index ${index}) from loading state`);
                }
              }
            });
          }
          
          return hasUpdates ? newResults : prev;
        });
        
        // 动态调整批次大小 - 优化逻辑
        const successCount = batchResults.filter((r: any) => r.success).length;
        const errorCount = batchResults.filter((r: any) => !r.success).length;
        const errorRate = errorCount / batchResults.length;

        // 只有在真正的网络错误或超时时才减少批次大小
        const realErrors = batchResults.filter((r: any) => 
          !r.success && r.error !== "invalid_data" && r.error !== "invalid_response"
        ).length;

        if (realErrors > 0 && consecutiveErrors >= maxConsecutiveErrors) {
          // 如果有真正的错误（网络、超时等），减少批次大小
          batchSize = Math.max(3, Math.floor(batchSize * 0.8));
          logger.warn(`Reducing batch size to ${batchSize} due to ${realErrors} real errors`);
        } else if (successCount === batchResults.length && consecutiveErrors === 0) {
          // 如果全部成功，增加批次大小
          batchSize = Math.min(15, Math.floor(batchSize * 1.1));
          logger.info(`Increasing batch size to ${batchSize} due to ${successCount} successes`);
        } else if (errorRate < 0.3) {
          // 如果错误率低于30%，保持或略微增加批次大小
          batchSize = Math.min(12, batchSize + 1);
          logger.debug(`Maintaining batch size at ${batchSize} (error rate: ${(errorRate * 100).toFixed(1)}%)`);
        }

        // 智能延迟，根据错误率调整
        if (i + batchSize < domains.length) {
          const errorRate = errorCount / batchResults.length;
          const delay = errorRate > 0.5 ? 1000 : errorRate > 0.2 ? 500 : 200; // 根据错误率调整延迟
          
          logger.debug(`Batch ${Math.floor(i / batchSize) + 1} completed: ${successCount}/${batchResults.length} success, error rate: ${(errorRate * 100).toFixed(1)}%, delay: ${delay}ms`);
          
          await sleep(delay);
        }
      }

      // 所有查询完成后，重新计算优先级确保高、中、低三档分布
      if (allResults.length > 0) {
        const allGlobalRanks = allResults.map((r: any) => r.globalRank);
        const allMonthlyVisits = allResults.map((r: any) => r.monthlyVisits);

        onResultsUpdate((prev) => {
          const newResults = [...prev];
          
          // 为每个唯一域名计算优先级
          for (const result of allResults) {
            const priority = calculatePriority(
              result.globalRank,
              result.monthlyVisits,
              allGlobalRanks,
              allMonthlyVisits,
            );
            
            // 更新所有相同域名的记录
            const indices = domainToIndices.get(result.domain) || [];
            indices.forEach((index: any) => {
              if (index < newResults.length) {
                newResults[index] = {
                  ...newResults[index],
                  测试优先级: priority
                };
              }
            });
          }
          
          return newResults;
        });
      }

      // 最终清理：确保没有域名仍然处于加载状态
      logger.info("Starting final cleanup to remove any remaining loading states...");
      onResultsUpdate((prev) => {
        const newResults = [...prev];
        let hasUpdates = false;
        let loadingCount = 0;
        
        for (let i = 0; i < newResults.length; i++) {
          const result = newResults[i];
          const isLoading = result.GlobalRank === "loading" || result.MonthlyVisits === "loading" || result.测试优先级 === "loading";
          
          if (isLoading) {
            loadingCount++;
            newResults[i] = {
              ...result,
              GlobalRank: result.GlobalRank === "loading" ? null : result.GlobalRank,
              MonthlyVisits: result.MonthlyVisits === "loading" ? null : result.MonthlyVisits,
              测试优先级: result.测试优先级 === "loading" ? null : result.测试优先级
            };
            hasUpdates = true;
            logger.info(`Final cleanup: Updated ${result.domain} from loading state`);
          }
        }
        
        logger.info(`Final cleanup completed: ${loadingCount} domains were still loading and have been updated`);
        return hasUpdates ? newResults : prev;
      });
      onStatusUpdate(false, false);
      onProgressUpdate(""); // 查询结束后清空
    } catch (error) {
      logger.error("分析错误: " + (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }, [domains, originalData, locale, onProgressUpdate, onResultsUpdate, onStatusUpdate]);
  
  // 计算预计完成时间
  const getEstimatedCompletionTime = useCallback((remainingDomains: number) => {
    if (rateLimitStatus.isLimited) {
      const waitTime = Math.max(0, rateLimitStatus.resetTime - Date.now());
      const avgTimePerRequest = 2000; // 平均每个请求2秒
      return waitTime + (remainingDomains * avgTimePerRequest);
    }
    
    const avgTimePerRequest = rateLimitStatus.remaining < 100 ? 3000 : 1500;
    return remainingDomains * avgTimePerRequest;
  }, [rateLimitStatus]);

  return { 
    startAnalysis,
    rateLimitStatus,
    getEstimatedCompletionTime
  };
};

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
