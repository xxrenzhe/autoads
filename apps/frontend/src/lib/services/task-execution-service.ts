/**
 * 前端最小兼容层：仅保留 UI 依赖的工具函数（UA/Referer/间隔）。
 * 执行器逻辑已迁移至 Go 后端。
 */

// 极简 UA 池（稳定且足够）
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
]

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

const SOCIAL_MEDIA_REFERERS = [
  'https://www.facebook.com/',
  'https://www.youtube.com/',
  'https://x.com/'
]
let socialRefererIndex = 0

export function getReferer(
  refererOption: 'social' | 'custom',
  customReferer?: string,
  selectedSocialMedia?: string
): string | undefined {
  if (refererOption === 'custom') return customReferer || undefined
  if (selectedSocialMedia) return selectedSocialMedia
  const ref = SOCIAL_MEDIA_REFERERS[socialRefererIndex]
  socialRefererIndex = (socialRefererIndex + 1) % SOCIAL_MEDIA_REFERERS.length
  return ref
}

export function calculateInterval(baseInterval: number): number {
  if (baseInterval <= 0) return 100
  return baseInterval * 1000
}

export const __DEPRECATED__ = true

/**
 * 计算间隔时间
 */
export function calculateInterval(baseInterval: number): number {
  // 如果baseInterval为0或很小，使用最小间隔100ms
  if (baseInterval <= 0) {
    return 100; // 最小间隔100ms
  }
  return baseInterval * 1000;
}

/**
 * 使用代理执行URL访问（简化版）
 */
export async function visitUrlWithProxy(
  url: string,
  proxyPool: ProxyConfig[],
  referer?: string,
  taskId?: string,
  currentIndex?: number,
  totalUrls?: number,
  useFallback: boolean = false,
  refererOption?: 'social' | 'custom',
  browserFingerprint?: any,
  forceDirectConnection: boolean = false,
  optimizationOptions?: {
    enableAdvancedOptimization?: boolean;
    optimizationPreset?: 'stealth' | 'performance' | 'balanced';
    proxyGeoInfo?: any;
    currentRound?: number;
  },
  accessMode?: 'http' | 'puppeteer'
): Promise<{ success: boolean; error?: string; verification?: any; shouldSkipRetry?: boolean; errorCategory?: string }> {
  // 检查任务是否被终止（高优先级）
  if (isTaskTerminated(taskId)) {
    logger.info(`任务 ${taskId} 已终止，停止访问: ${url}`);
    return { success: false, error: '任务已终止' };
  }

  try {
    // 验证referer配置（允许为空，表示不发送Referer头）
    if (referer && !referer.startsWith('http://') && !referer.startsWith('https://')) {
      logger.error('Referer格式无效', new EnhancedError('Referer格式无效', { url, referer }));
      return { success: false, error: 'Referer配置无效：格式错误' };
    }
    
    // 决定是否使用代理
    let proxy: ProxyConfig | undefined = undefined;
    const useProxy = !forceDirectConnection && proxyPool.length > 0;
    
    if (useProxy) {
      // 使用统一代理服务分配代理
      const proxyIndex = (currentIndex || 1) % proxyPool.length;
      proxy = proxyPool[proxyIndex];
      
      if (proxy) {
        logger.info(`🔄 代理分配 [轮询模式]`, {
          visitId: taskId ? `${taskId}_${currentIndex}` : `url_${currentIndex}`,
          url: url.substring(0, 60) + (url.length > 60 ? '...' : ''),
          proxyIndex: proxyIndex + 1,
          totalProxies: proxyPool.length,
          assignedProxy: `${proxy.host}:${proxy.port}`,
          proxyProvider: proxy.provider,
          proxyProtocol: proxy.protocol,
          hasAuth: !!(proxy.username && proxy.password),
          sessionId: proxy.sessionId,
          rotationStrategy: 'round-robin'
        });
      } else {
        logger.warn('⚠️ 代理分配失败', {
          url: url.substring(0, 60) + (url.length > 60 ? '...' : ''),
          proxyIndex,
          totalProxies: proxyPool.length,
          error: 'No proxy available at index'
        });
      }
    }
    
    if (!proxy && useProxy) {
      logger.warn('代理池为空，使用直连模式', { url });
    }
    
    // 生成简单的浏览器标识
    const fingerprint = {
      userAgent: getRandomUserAgent(),
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    };
    
    // 详细记录访问配置信息
    logger.info(`🌐 开始访问URL: ${url}`, {
      progress: currentIndex && totalUrls ? `${currentIndex}/${totalUrls}` : undefined,
      mode: useFallback ? 'HTTP-fallback' : 'Playwright',
      proxy: proxy ? {
        server: `${proxy.protocol || 'http'}://${proxy.host}:${proxy.port}`,
        username: proxy.username ? '[已设置]' : undefined,
        authentication: proxy.username && proxy.password ? '已启用' : '未启用',
        sessionId: proxy.sessionId || undefined,
        provider: proxy.provider || undefined,
        type: proxy.provider === 'iprocket' ? '动态IP' : '静态IP'
      } : 'direct',
      referer: {
        configured: referer,
        type: refererOption === 'custom' ? '自定义' : '社交媒体轮询',
        isValid: !referer || referer.startsWith('http://') || referer.startsWith('https://')
      },
      browserInfo: {
        userAgent: fingerprint.userAgent.substring(0, 100) + '...',
        mode: 'HTTP headers'
      }
    });

    // 添加随机延迟（模拟人类浏览行为）
    await addRandomDelay();

    // 根据访问模式选择访问方式
    const accessStartTime = Date.now();
    let rawResult;
    
    logger.info(`🚀 开始访问 [${accessMode?.toUpperCase() || 'HTTP'}模式]`, {
      visitId: taskId ? `${taskId}_${currentIndex}` : `url_${currentIndex}`,
      url: url.substring(0, 80) + (url.length > 80 ? '...' : ''),
      mode: accessMode || 'http',
      timeout: accessMode === 'puppeteer' ? 120000 : 90000,
      hasProxy: !!proxy,
      proxyServer: proxy ? `${proxy.host}:${proxy.port}` : 'direct',
      expectedLoadTime: accessMode === 'puppeteer' ? '30-60s' : '5-15s'
    });
    
    if (accessMode === 'puppeteer') {
      rawResult = await puppeteerVisitor.visitUrl({
        url,
        proxy,
        referer,
        userAgent: fingerprint.userAgent,
        headers: fingerprint.headers,
        timeout: 120000  // Puppeteer需要更长的超时时间
      });
    } else {
      rawResult = await simpleHttpVisitor.visitUrl({
        url,
        proxy,
        referer,
        userAgent: fingerprint.userAgent,
        headers: fingerprint.headers,
        timeout: 90000  // 增加超时时间以处理网络不稳定问题
      });
    }
    
    const accessEndTime = Date.now();
    const actualAccessTime = accessEndTime - accessStartTime;
    
    // 标准化结果以统一接口
    const result = normalizeVisitorResult(rawResult, accessMode || 'http');

    // 详细记录验证结果和访问状态
    logger.info(`📊 访问结果分析`, {
      visitId: taskId ? `${taskId}_${currentIndex}` : `url_${currentIndex}`,
      url: url.substring(0, 60) + (url.length > 60 ? '...' : ''),
      success: result.success,
      actualAccessTime: `${actualAccessTime}ms`,
      expectedTime: accessMode === 'puppeteer' ? '120000ms' : '90000ms',
      timeVsExpected: actualAccessTime > (accessMode === 'puppeteer' ? 120000 : 90000) ? '⚠️ 超时' : '✅ 正常',
      statusCode: result.statusCode,
      loadTime: result.loadTime ? `${result.loadTime}ms` : undefined,
      proxyVerification: result.proxyVerification ? {
        success: result.proxyVerification.success,
        actualIP: result.proxyVerification.actualIP,
        expectedProxy: proxy ? `${proxy.host}:${proxy.port}` : 'direct',
        status: result.proxyVerification.proxyStatus,
        error: result.proxyVerification.error
      } : undefined,
      refererVerification: result.refererVerification ? {
        success: result.refererVerification.success,
        expected: result.refererVerification.actualReferer ? '匹配' : '不匹配',
        actual: result.refererVerification.actualReferer,
        status: result.refererVerification.refererStatus
      } : undefined,
      performance: {
        mode: accessMode || 'http',
        userAgent: fingerprint.userAgent.substring(0, 100) + '...',
        timeout: accessMode === 'puppeteer' ? 120000 : 90000,
        actualTime: actualAccessTime,
        efficiency: result.loadTime && actualAccessTime ? 
          Math.round((result.loadTime / actualAccessTime) * 100) : undefined
      },
      error: result.error ? {
        message: result.error,
        type: result.error.includes('timeout') ? 'timeout' : 
               result.error.includes('proxy') ? 'proxy' : 'other'
      } : undefined
    });

    // 增强的错误处理和分类
    if (!result.success && result.error) {
      const errorMessage = result.error.toLowerCase();
      
      // 1. 可忽略的网站插件/脚本错误
      if (errorMessage.includes('initautotyper is not defined') || 
          errorMessage.includes('toolbox') || 
          errorMessage.includes('action run javascript') ||
          errorMessage.includes('plugin_') ||
          errorMessage.includes('third-party script') ||
          errorMessage.includes('script loading') ||
          errorMessage.includes('tiktok') ||
          errorMessage.includes('analytics') ||
          errorMessage.includes('cdn') ||
          errorMessage.includes('resource loading')) {
        logger.warn(`🟡 网站资源加载错误(可忽略)`, {
          visitId: taskId ? `${taskId}_${currentIndex}` : `url_${currentIndex}`,
          url: url.substring(0, 60) + (url.length > 60 ? '...' : ''),
          error: result.error,
          category: 'resource_loading',
          severity: 'low',
          action: 'ignore'
        });
        return { success: true, verification: result.proxyVerification };
      }
      
      // 2. 超时错误特殊处理 - 增加详细日志
      if (errorMessage.includes('timeout') || errorMessage.includes('timed_out') || errorMessage.includes('navigation timeout')) {
        const timeoutDetails = {
          expectedTimeout: accessMode === 'puppeteer' ? '120000ms' : '90000ms',
          actualTime: `${actualAccessTime}ms`,
          timeExceeded: actualAccessTime - (accessMode === 'puppeteer' ? 120000 : 90000),
          proxyUsed: !!proxy,
          proxyServer: proxy ? `${proxy.host}:${proxy.port}` : 'direct',
          accessMode: accessMode || 'http',
          url: url.substring(0, 60) + (url.length > 60 ? '...' : '')
        };
        
        logger.error(`⏰ 访问超时`, {
          visitId: taskId ? `${taskId}_${currentIndex}` : `url_${currentIndex}`,
          ...timeoutDetails,
          error: result.error,
          category: 'timeout',
          severity: 'high',
          action: 'log_and_continue',
          recommendation: actualAccessTime > (accessMode === 'puppeteer' ? 150000 : 120000) ? 
            '考虑增加超时时间或检查网络连接' : 
            '代理可能响应缓慢，尝试更换代理'
        });
        
        return { 
          success: false, 
          error: result.error, 
          shouldSkipRetry: false,
          errorCategory: 'timeout'
        };
      }
      
      // 3. 网络连接问题 - 根据错误类型分级处理
      const networkErrors = [
        // 连接重置错误 (临时性网络问题)
        'err_connection_reset',
        'net::err_connection_reset',
        'connection reset',
        
        // 代理连接失败
        'err_proxy_connection_failed',
        'err_tunnel_connection_failed',
        
        // 协议错误
        'err_quic_protocol_error',
        'err_http2_protocol_error',
        
        // 其他网络错误
        'err_network_changed',
        'net::err_'
      ];
      
      const isNetworkError = networkErrors.some(error => errorMessage.includes(error));
      
      if (isNetworkError) {
        // 根据错误类型确定处理策略
        let errorCategory = 'network_error';
        let shouldSkipRetry = false;
        
        if (errorMessage.includes('connection_reset')) {
          errorCategory = 'connection_reset';
          shouldSkipRetry = true; // 连接重置通常是临时的，跳过重试
        } else if (errorMessage.includes('proxy_connection_failed')) {
          errorCategory = 'proxy_failure';
          shouldSkipRetry = true;
        }
        
        // 记录详细错误信息
        logger.warn(`🔌 网络连接问题 [${errorCategory.toUpperCase()}]`, {
          visitId: taskId ? `${taskId}_${currentIndex}` : `url_${currentIndex}`,
          url: url.substring(0, 60) + (url.length > 60 ? '...' : ''),
          error: result.error,
          category: errorCategory,
          severity: shouldSkipRetry ? 'low' : 'medium',
          proxyUsed: proxy ? `${proxy.host}:${proxy.port}` : 'direct',
          action: shouldSkipRetry ? 'skip_retry' : 'allow_retry'
        });
        
        return { 
          success: false, 
          error: result.error, 
          shouldSkipRetry,
          errorCategory 
        };
      }
      
      // 3. 代理验证失败的特殊处理
      if (errorMessage.includes('actual ip') && errorMessage.includes('expected')) {
        logger.warn(`代理验证失败(IP不匹配): ${url}`, { 
          error: result.error,
          category: 'proxy_verification',
          severity: 'medium'
        });
        // 不标记为失败，因为访问本身可能成功
        return { success: true, verification: result.proxyVerification };
      }
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCategory = categorizeException(errorMessage);
    
    logger.error(`访问异常: ${url}`, new EnhancedError(`访问异常: ${url}`, { 
      error: errorMessage,
      category: errorCategory 
    }));
    
    return { 
      success: false, 
      error: errorMessage,
      errorCategory 
    };
  }
}

/**
 * 添加随机延迟（模拟人类行为）
 */
async function addRandomDelay(): Promise<void> {
  // 基础延迟：1-3秒
  const baseDelay = 1000 + Math.random() * 2000;
  
  // 10% 概率添加更长延迟（模拟用户分心）
  const longDelayProbability = 0.1;
  if (Math.random() < longDelayProbability) {
    const longDelay = 5000 + Math.random() * 10000; // 5-15秒
    logger.debug(`添加长延迟: ${longDelay}ms`);
    await new Promise(resolve => setTimeout(resolve, longDelay));
  } else {
    logger.debug(`添加基础延迟: ${baseDelay}ms`);
    await new Promise(resolve => setTimeout(resolve, baseDelay));
  }
}

/**
 * 异常错误分类函数
 */
function categorizeException(errorMessage: string): string {
  const lowerMessage = errorMessage.toLowerCase();
  
  if (lowerMessage.includes('econnreset') || lowerMessage.includes('connection reset')) {
    return 'connection_reset';
  } else if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'timeout';
  } else if (lowerMessage.includes('proxy') || lowerMessage.includes('socks')) {
    return 'proxy_error';
  } else if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return 'network_error';
  } else {
    return 'unknown_error';
  }
}

/**
 * 生成错误摘要
 */
function generateErrorSummary(errors: string[]): ErrorSummary {
  const summary: ErrorSummary = {
    totalErrors: errors.length,
    byCategory: {},
    hasErrors: errors.length > 0,
    hasSignificantErrors: false,
    mostCommonError: undefined
  };

  if (errors.length === 0) {
    return summary;
  }

  // 按类别统计错误
  errors.forEach((error: any) => {
    const category = categorizeErrorForSummary(error);
    summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;
  });

  // 找出最常见的错误
  const categoryCounts = Object.entries(summary.byCategory);
  if (categoryCounts.length > 0) {
    const [mostCommonCategory, count] = categoryCounts.sort((a, b) => b[1] - a[1])[0];
    summary.mostCommonError = mostCommonCategory;
    
    // 判断是否有显著错误（超过20%的错误属于同一类别）
    const errorRate = count / errors.length;
    summary.hasSignificantErrors = errorRate > 0.2;
  }

  return summary;
}

/**
 * 为错误摘要分类错误
 */
function categorizeErrorForSummary(error: string): string {
  const lowerError = error.toLowerCase();
  
  if (lowerError.includes('connection reset') || lowerError.includes('econnreset')) {
    return 'connection_reset';
  } else if (lowerError.includes('proxy') || lowerError.includes('socks')) {
    return 'proxy_related';
  } else if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
    return 'timeout';
  } else if (lowerError.includes('network') || lowerError.includes('fetch')) {
    return 'network_issue';
  } else if (lowerError.includes('script') || lowerError.includes('tiktok') || lowerError.includes('cdn')) {
    return 'third_party_resource';
  } else if (lowerError.includes('verification') || lowerError.includes('actual ip')) {
    return 'proxy_verification';
  } else {
    return 'other';
  }
}

/**
 * 执行批量任务（简化版）
 */
export async function executeBatchTask(options: TaskExecutionOptions): Promise<TaskExecutionResult> {
  const startTime = Date.now();
  const {
    taskId,
    urls,
    cycleCount,
    openCount = 1, // 默认值，静默模式不使用此参数
    openInterval,
    proxyUrl,
    refererOption,
    selectedSocialMedia,
    customReferer,
    proxyValidated,
    concurrencyLimit = 3
  } = options;

  // 设置任务执行状态标志，禁用后台代理补充
  globalStateManager.setExecutionFlag(taskId, true);
  logger.info(`任务执行开始，已禁用后台代理补充`, { taskId });

  logger.info('开始执行批量任务:', {
    taskId,
    urlCount: urls.length,
    cycleCount,
    openCount: options.isSilentMode ? 'N/A' : openCount,
    openInterval,
    proxyUrl: proxyValidated ? '[已验证]' : '[未验证]',
    refererOption
  });

  // 使用前置计算的访问次数
  let totalVisits = options.actualTotalVisits || (options.isSilentMode 
    ? urls.length * cycleCount 
    : urls.length * cycleCount * (openCount || 1));
  
  // 验证总访问次数的一致性
  if (options.isSilentMode && options.urlVisits) {
    const calculatedTotal = options.urlVisits.reduce((sum, visits: any) => sum + visits, 0);
    if (calculatedTotal !== totalVisits) {
      logger.warn('总访问次数不一致，使用计算值', {
        taskId,
        providedTotal: totalVisits,
        calculatedTotal,
        urlVisits: options.urlVisits
      });
      totalVisits = calculatedTotal;
    }
  }
  
  // 始终设置初始状态，确保任务能正确启动
  const initialTaskState = {
    status: 'running' as const,
    progress: 0,
    total: totalVisits,
    startTime,
    message: '任务初始化...'
  };
  await silentBatchTaskManager.setTask(taskId, initialTaskState);
  logger.info('🚀 任务初始状态已设置', {
    taskId,
    progress: 0,
    total: totalVisits,
    message: '任务初始化...'
  });

  
  let completed = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    // 获取代理池
    let proxyPool: ProxyConfig[] = [];
    if (proxyUrl) {
      // 计算需要获取的代理数量
      let requiredProxyCount = cycleCount;
      
      // 检查是否使用单代理策略
      if (options.useSingleProxyStrategy) {
        // 单代理策略：固定轮次，每轮必须完成所有URL
        requiredProxyCount = cycleCount;
        logger.info('单代理策略已启用，禁用轮次随机化', {
          cycleCount,
          proxyCount: requiredProxyCount
        });
      }
      
      // 更新任务状态：任务初始化完成，进入代理验证阶段
      logger.info(`🔄 设置状态为"代理验证中" - 任务ID: ${taskId}`);
      await silentBatchTaskManager.setTask(taskId, {
        status: 'running',
        progress: 0,
        total: totalVisits,
        startTime,
        message: '代理验证中...'
      });
      
      // 等待一小段时间确保前端能收到状态
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 如果代理未验证，则在获取代理前进行验证
      if (!proxyValidated) {
        logger.info(`🔄 代理验证阶段 - 任务ID: ${taskId}`);
        await silentBatchTaskManager.setTask(taskId, {
          status: 'running',
          progress: 5,
          total: totalVisits,
          startTime,
          message: '代理验证中...'
        });
        
        // 等待一小段时间确保前端能收到状态
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          // 进行代理验证
          const validation = await proxyService.validateProxyConfiguration(proxyUrl);
          if (!validation.isValid) {
            const errorContext = createProxyErrorContext('proxy_validation', {
              proxyUrl,
              taskId,
              totalUrls: urls.length,
              requiredProxyCount
            });
            
            const errorResult = handleProxyError(
              `代理验证失败: ${validation.error}`, 
              errorContext
            );
            
            logger.error('代理验证失败:', new EnhancedError(errorResult.error, { 
              validation, 
              errorCategory: errorResult.errorCategory 
            }));
            
            throw new EnhancedError(errorResult.error, { 
              validation, 
              errorCategory: errorResult.errorCategory,
              shouldRetry: errorResult.shouldRetry
            });
          }
          
          logger.info('代理验证成功:', { proxyUrl });
          
                      
        } catch (validationError) {
          const errorMessage = validationError instanceof Error ? validationError.message : String(validationError);
          logger.error('代理验证阶段失败', validationError instanceof Error ? validationError : new Error(errorMessage));
          
          // 更新任务状态为验证失败
          await silentBatchTaskManager.setTask(taskId, {
            status: 'failed',
            progress: 8,
            total: totalVisits,
            startTime,
            endTime: Date.now(),
            message: `代理验证失败: ${errorMessage}`
          });
          
          // 重新抛出错误
          throw validationError;
        }
      }
      
      // 更新状态为开始获取代理
      logger.info(`🔄 设置状态为"代理IP获取中" - 任务ID: ${taskId}`);
      const proxyFetchStartState = {
        status: 'running' as const,
        progress: 20,
        total: totalVisits,
        startTime,
        message: `代理IP获取中... (0/${requiredProxyCount})`
      };
      await silentBatchTaskManager.setTask(taskId, proxyFetchStartState);
      
      try {
        // 添加任务终止检查
        if (isTaskTerminated(taskId)) {
          logger.info(`任务 ${taskId} 被终止，停止代理获取`);
          return {
            success: false,
            completed: 0,
            failed: 0,
            errors: ['任务被用户终止'],
            duration: Date.now() - startTime
          };
        }
        
        // 获取代理池
        proxyPool = await fetchProxyPool(
          proxyUrl, 
          requiredProxyCount, 
          options.isSilentMode || false, 
          taskId,
          urls.length,  // 传递URL数量
          true  // 启用代理缓存
        );
        
        // 验证代理获取结果
        if (!proxyPool || proxyPool.length === 0) {
          throw new Error(`代理获取失败：未能获取到任何代理，请检查代理API配置和响应格式`);
        }
        
        // 验证代理数量是否满足要求
        // 优化策略：完整批量重试机制
        // - 每次重试都获取完整数量的代理（cycleCount），而不是只获取缺少的部分
        // - 使用新获取的完整代理池替换现有代理池，避免代理API返回重复代理的问题
        // - 这种策略能够获得更多样化的代理，提高代理质量和可用性
        let retryCount = 0;
        const maxRetries = 3;
        let finalProxyPool = proxyPool;
        
        while (finalProxyPool.length < requiredProxyCount && retryCount < maxRetries) {
          if (retryCount > 0) {
            // 代理数量不足，需要重试获取完整数量的代理
            logger.warn(`⚠️ 代理去重后数量不足，发起第 ${retryCount + 1} 次重试获取`, {
              taskId,
              currentProxyCount: finalProxyPool.length,
              requiredProxyCount,
              retryCount,
              strategy: 'full_batch_retry'  // 标记使用完整批量重试策略
            });
            
            // 更新任务状态：代理重试获取中
            await silentBatchTaskManager.setTask(taskId, {
              status: 'running',
              progress: 25,
              total: totalVisits,
              startTime,
              message: `代理IP重试获取中... (${retryCount + 1}/${maxRetries})`
            });
            
            // 等待一小段时间确保前端能收到状态
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          if (finalProxyPool.length < requiredProxyCount) {
            try {
              // 优化：每次重试都获取完整数量的代理，而不是只获取缺少的部分
              const retryProxies = await fetchProxyPool(
                proxyUrl, 
                requiredProxyCount,  // 获取完整数量
                options.isSilentMode || false, 
                taskId,
                urls.length,
                false   // 禁用缓存，确保获取新的代理
              );
              
              if (retryProxies && retryProxies.length > 0) {
                // 替换策略：用新获取的完整代理池替换现有的代理池
                finalProxyPool = retryProxies;
                
                logger.info(`🔄 代理重试获取完成（完整批量策略）`, {
                  taskId,
                  retryCount: retryCount + 1,
                  previousPoolSize: finalProxyPool.length,
                  newPoolSize: retryProxies.length,
                  requiredProxyCount,
                  strategy: 'replaced_with_full_batch'  // 标记为完整批量替换策略
                });
              }
            } catch (retryError) {
              const errorMessage = retryError instanceof Error ? retryError.message : String(retryError);
              logger.warn(`代理重试获取失败`, new EnhancedError('代理重试获取失败', {
                taskId,
                retryCount: retryCount + 1,
                error: errorMessage,
                strategy: 'full_batch_retry'
              }));
            }
            
            retryCount++;
          }
        }
        
        // 最终检查代理数量
        if (finalProxyPool.length < requiredProxyCount) {
          // 重试后仍然不足，但使用回退策略：允许任务继续执行，使用代理轮转
          const errorMessage = `代理获取不足：使用完整批量重试策略 ${maxRetries} 次后仅获取到 ${finalProxyPool.length}/${requiredProxyCount} 个代理，将使用代理轮转策略继续执行`;
          logger.warn(`⚠️ 代理数量不足，启用回退策略`, new EnhancedError(`代理数量不足，启用回退策略`, {
            taskId,
            errorMessage,
            proxyPoolSize: finalProxyPool.length,
            requiredProxyCount,
            retryAttempts: maxRetries,
            retryStrategy: 'full_batch',  // 标记使用的重试策略
            fallbackStrategy: 'proxy_rotation'
          }));
          
          // 更新任务状态为警告，但继续执行
          await silentBatchTaskManager.setTask(taskId, {
            status: 'running',
            progress: 30,
            total: totalVisits,
            startTime,
            message: `代理数量不足，使用轮转策略继续执行 (${finalProxyPool.length}/${requiredProxyCount})`
          });
          
          // 继续执行任务，但标记为使用了回退策略
          logger.info(`🔄 启用代理轮转回退策略，任务将继续执行`, {
            taskId,
            availableProxies: finalProxyPool.length,
            requiredProxies: requiredProxyCount,
            rotationEnabled: true
          });
        }
        
        // 更新代理池为最终的去重结果
        proxyPool = finalProxyPool;
        
        // 再次检查任务是否被终止
        if (isTaskTerminated(taskId)) {
          logger.info(`任务 ${taskId} 被终止，停止任务执行`);
          return {
            success: false,
            completed: 0,
            failed: 0,
            errors: ['任务被用户终止'],
            duration: Date.now() - startTime
          };
        }
        
        logger.info(`✅ 代理获取成功`, {
          taskId,
          proxyPoolSize: proxyPool.length,
          requiredProxyCount
        });
        
        // 更新任务状态：代理获取完成
        await silentBatchTaskManager.setTask(taskId, {
          status: 'running',
          progress: 40,
          total: totalVisits,
          startTime,
          message: `代理获取完成 (${proxyPool.length}/${requiredProxyCount})`
        });
        
      } catch (proxyError) {
        // 代理获取失败，终止任务
        const errorMessage = proxyError instanceof Error ? proxyError.message : String(proxyError);
        logger.error('代理获取失败，任务终止', new EnhancedError('代理获取失败', {
          error: errorMessage,
          required: requiredProxyCount,
          taskId
        }));
        
        // 更新任务状态为失败
        await silentBatchTaskManager.setTask(taskId, {
          status: 'failed',
          progress: 25,
          total: totalVisits,
          startTime,
          endTime: Date.now(),
          message: `代理获取失败：${errorMessage}`
        });
        
        // 重新抛出错误，终止任务执行
        throw new Error(`代理获取失败：${errorMessage}`);
      }
    } else {
      // 没有代理或代理未验证，直接开始批量访问
      const message = '批量访问中...';
      
      logger.info(`使用直连模式执行任务:`, {
        proxyUrl: proxyUrl ? '[已配置]' : '[未配置]',
        proxyValidated: proxyValidated || false,
        reason: !proxyUrl ? '未配置代理URL' : '代理未通过验证'
      });
      
      await silentBatchTaskManager.setTask(taskId, {
        status: 'running' as const,
        progress: 40,
        total: totalVisits,
        startTime,
        message
      });
    }

    // 执行批量访问
    logger.info('🚀 开始执行批量访问阶段', {
      taskId,
      isSilentMode: options.isSilentMode,
      useSingleProxyStrategy: options.useSingleProxyStrategy,
      totalVisits,
      urlsCount: urls.length
    });
    
    // 检查是否使用单代理每轮访问策略
    if (options.useSingleProxyStrategy) {
      // 使用新的单代理策略（解决浏览器实例爆炸问题）
      logger.info('🚀 使用单代理每轮访问策略（解决浏览器实例爆炸问题）', {
        taskId,
        totalUrls: urls.length,
        cycleCount,
        proxyPoolSize: proxyPool.length,
        expectedSavings: `${Math.round((1 - 1/cycleCount) * 100)}% 浏览器实例节省`
      });
      
      try {
        // 检查是否启用简单双层并发功能
        if (options.enableSimpleConcurrency) {
          // 启用简单双层并发功能以优化执行效率
          logger.info('⚡ 启用简单双层并发功能优化执行效率', {
            taskId,
            enableRoundConcurrency: true,
            maxConcurrentRounds: Math.min(proxyPool.length, 3), // 最多2个代理并发（4GB优化）
            enableUrlConcurrency: true,
            maxConcurrentUrls: Math.min(urls.length, 5), // 每个代理最多3个URL并发（4GB优化）
            optimizationNote: '每个代理IP独立完成一轮URL访问'
          });
          
          logger.info('创建 SimpleConcurrentExecutor，使用HTTP访问模式:', {
            taskId
          });
          
          // 添加调试日志来跟踪传递给 SimpleConcurrentExecutor 的参数
          const executorReferer = getReferer(refererOption, customReferer, selectedSocialMedia);
          logger.info('SimpleConcurrentExecutor 参数配置:', {
            taskId,
            refererOption,
            selectedSocialMedia: selectedSocialMedia || '[undefined]',
            customReferer: customReferer || '[undefined]',
            computedReferer: executorReferer || '[undefined]'
          });
          
          const simpleExecutor = new SimpleConcurrentExecutor({
            taskId,
            urls,
            cycleCount,
            visitInterval: openInterval || 100, // 如果为0则使用100ms
            roundInterval: Math.max(openInterval * 2 || 200, 500), // 轮次间隔至少500ms
            timeout: 90000,
            proxyPool,
            referer: executorReferer,
            refererOption, // 新增：传递referer选项
            selectedSocialMedia, // 新增：传递选择的特定社交媒体
            customReferer, // 新增：传递自定义referer
            enableRoundConcurrency: true,
            maxConcurrentRounds: Math.min(proxyPool.length, 3), // 限制并发代理数（4GB优化）
            enableUrlConcurrency: true,
            maxConcurrentUrls: Math.min(urls.length, 5), // 限制每个代理的并发URL数（4GB优化）
            verifyProxyIP: options.verifyProxyIP || false,
            accessMode: options.accessMode || 'http',
            onProgress: async (progress) => {
              await silentBatchTaskManager.setTask(taskId, {
                status: 'running',
                progress: Math.round((progress.completed / progress.total) * 100),
                total: totalVisits,
                startTime,
                successCount: progress.completed,
                failCount: progress.failed,
                message: `批量访问中...`
              });
            }
          });
          
          // 执行任务
          const executorResult = await simpleExecutor.start();
          
          // 更新结果
          completed = executorResult.completed;
          failed = executorResult.failed;
          errors.push(...(executorResult.errors || []));
          
          logger.info('⚡ 简单并发执行完成', {
            taskId,
            completed,
            failed,
            duration: executorResult.executionTime,
            performance: executorResult.performance,
            successRate: `${((completed / totalVisits) * 100).toFixed(1)}%`
          });
          
          // 成功执行后直接返回，避免继续执行其他策略
          return {
            success: true,
            completed,
            failed,
            errors,
            duration: Date.now() - startTime
          };
        }
        
        // 如果没有启用简单并发功能，使用原始单代理策略
        logger.info('📋 使用原始单代理策略（不启用并发功能）', {
          taskId,
          cycleCount,
          proxyPoolSize: proxyPool.length
        });
        
        // 使用简单的单代理执行器
        // 使用代理池的第一个代理（单代理模式）
        const singleProxy = proxyPool[0];
        const singleProxyService = new SimpleSingleProxyExecutor({
          taskId,
          urls,
          cycleCount,
          proxyUrl: singleProxy,
          visitInterval: openInterval || 100, // 如果为0则使用100ms
          timeout: 90000,
          totalVisits,
          startTime,
          refererOption: options.refererOption,
          selectedSocialMedia: options.selectedSocialMedia,
          customReferer: options.customReferer,
          verifyProxyIP: options.verifyProxyIP
        });
        
        // 执行单代理
        const result = await singleProxyService.start();
        
        // 更新结果
        completed = result.successCount;
        failed = result.failCount;
        errors.push(...(result.errors || []));
        
        logger.info('📋 单代理执行完成', {
          taskId,
          completed,
          failed,
          duration: result.executionTime,
          successRate: `${((completed / totalVisits) * 100).toFixed(1)}%`
        });
        
        // 清理服务
        await singleProxyService.destroy();
        
        // 成功执行后直接返回，避免继续执行其他策略
        return {
          success: true,
          completed,
          failed,
          errors,
          duration: result.executionTime
        };
        
      } catch (strategyError) {
        const errorMessage = strategyError instanceof Error ? strategyError.message : String(strategyError);
        logger.error('单代理执行失败', new EnhancedError('单代理执行失败', {
          taskId,
          error: errorMessage
        }));
        
        // 单代理失败，继续执行其他策略
        errors.push(errorMessage);
      }
    }
    
    // 检查是否启用简单并发功能但未使用单代理策略
    if (options.enableSimpleConcurrency && !options.useSingleProxyStrategy) {
      logger.info('⚡ 启用简单并发功能（非单代理模式）', {
        taskId,
        proxyPoolSize: proxyPool.length
      });
      
      logger.info('创建第二个 SimpleConcurrentExecutor（非单代理模式），使用HTTP访问模式:', {
          taskId
        });
        
        // 添加调试日志来跟踪传递给第二个 SimpleConcurrentExecutor 的参数
        const executorReferer2 = getReferer(refererOption, customReferer, selectedSocialMedia); // 修复：添加 selectedSocialMedia 参数
        logger.info('第二个 SimpleConcurrentExecutor 参数配置:', {
          taskId,
          refererOption,
          selectedSocialMedia: selectedSocialMedia || '[undefined]',
          customReferer: customReferer || '[undefined]',
          computedReferer: executorReferer2 || '[undefined]',
          fixed: '已修复：现在正确传递 selectedSocialMedia 参数'
        });
        
        const simpleExecutor = new SimpleConcurrentExecutor({
        taskId,
        urls,
        cycleCount,
        visitInterval: openInterval || 50, // 优化：如果为0则使用50ms
        roundInterval: Math.max(openInterval * 2 || 200, 300), // 优化：轮次间隔至少300ms
        timeout: 90000,
        proxyPool,
        referer: executorReferer2,
        refererOption, // 新增：传递referer选项
        customReferer, // 新增：传递自定义referer
        selectedSocialMedia, // 修复：添加缺失的 selectedSocialMedia 参数
        enableRoundConcurrency: options.enableRoundConcurrency ?? true,
        maxConcurrentRounds: options.maxConcurrentRounds ?? Math.min(proxyPool.length, 3),
        enableUrlConcurrency: options.enableUrlConcurrency ?? true,
        maxConcurrentUrls: options.maxConcurrentUrls ?? Math.min(urls.length, 5),
        verifyProxyIP: options.verifyProxyIP ?? false,
        accessMode: options.accessMode || 'http',
        onProgress: async (progress) => {
          await silentBatchTaskManager.setTask(taskId, {
            status: 'running',
            progress: Math.round((progress.completed / progress.total) * 100),
            total: totalVisits,
            startTime,
            successCount: progress.completed,
            failCount: progress.failed,
            message: `批量访问中...`
          });
        }
      });
      
      // 执行任务
      const executorResult = await simpleExecutor.start();
      
      // 更新结果
      completed = executorResult.completed;
      failed = executorResult.failed;
      errors.push(...(executorResult.errors || []));
      
      logger.info('⚡ 简单并发执行完成', {
        taskId,
        completed,
        failed,
        duration: executorResult.executionTime,
        performance: executorResult.performance,
        successRate: `${((completed / totalVisits) * 100).toFixed(1)}%`
      });
      
      // 成功执行后直接返回，避免继续执行其他策略
      return {
        success: true,
        completed,
        failed,
        errors,
        duration: Date.now() - startTime
      };
    }
    
    if (options.enableConcurrentExecution) {
      // 使用并发轮次策略（提高执行效率）
      logger.info('🚀 检测到并发执行功能，使用并发轮次代理策略', {
        taskId,
        maxConcurrency: options.maxConcurrency || 3,
        proxyReuseInterval: options.proxyReuseInterval || 1000
      });
      
      // 使用SimpleConcurrentExecutor执行并发任务
      const concurrentExecutor = new SimpleConcurrentExecutor({
        taskId,
        urls,
        cycleCount,
        visitInterval: openInterval || 100,
        roundInterval: options.proxyReuseInterval || 1000,
        timeout: 90000,
        proxyPool,
        refererOption: options.refererOption,
        selectedSocialMedia: options.selectedSocialMedia,
        customReferer: options.customReferer,
        verifyProxyIP: options.verifyProxyIP,
        enableRoundConcurrency: true,
        maxConcurrentRounds: options.maxConcurrency || 3,
        accessMode: options.accessMode || 'http',
        onProgress: async (progress) => {
          await silentBatchTaskManager.setTask(taskId, {
            status: 'running',
            progress: Math.round(((progress.completed + progress.failed) / progress.total) * 100),
            total: progress.total,
            startTime,
            successCount: progress.completed,
            failCount: progress.failed,
            message: `并发执行中... (${progress.completed}/${progress.total})`
          });
        }
      });
      
      // 执行任务
      const result = await concurrentExecutor.start();
      
      // 更新结果
      completed = result.completed;
      failed = result.failed;
      errors.push(...(result.errors || []));
      
      logger.info('🎉 并发执行完成', {
        taskId,
        completed,
        failed,
        duration: result.executionTime,
        successRate: `${((completed / totalVisits) * 100).toFixed(1)}%`
      });
    } else {
      // 不使用单代理策略，直接执行批量访问
      logger.info('🚀 使用标准批量访问策略', {
        taskId,
        isSilentMode: options.isSilentMode,
        totalUrls: urls.length,
        totalVisits
      });

      if (options.isSilentMode) {
        // 设置全局静默模式标志
        (globalThis as any).isSilentMode = true;
        
        // 静默模式：使用简化的批量访问逻辑
        logger.info('🚀 静默模式：使用简化批量访问服务', {
          taskId,
          totalUrls: urls.length,
          totalVisits,
          proxyPoolSize: proxyPool.length
        });
        
        // 使用前置计算的访问次数或默认值
        const urlVisits = options.urlVisits || urls.map(() => cycleCount);
        
        // 执行批量访问
        const batchResult = await executeSilentBatchVisit({
          taskId,
          urls,
          urlVisits,
          totalVisits,
          proxyPool,
          refererOption,
          selectedSocialMedia,
          customReferer,
          openInterval,
          startTime,
          proxyGeoInfo: options.proxyGeoInfo,
          accessMode: options.accessMode
        });
        
        // 更新结果统计
        completed = batchResult.completed;
        failed = batchResult.failed;
        errors.push(...batchResult.errors);
        
        logger.info('🎉 简化批量访问完成', {
          taskId,
          completed,
          failed,
          duration: batchResult.duration,
          successRate: `${((completed / totalVisits) * 100).toFixed(1)}%`
        });
      } else {
        // 普通模式：使用简化的批量访问逻辑
        logger.info('🚀 普通模式：使用简化的批量访问服务', {
          taskId,
          totalUrls: urls.length,
          cycleCount,
          openCount,
          totalVisits,
          proxyPoolSize: proxyPool.length
        });

        // 使用简化的普通模式批量访问服务
        const normalBatchResult = await executeNormalBatchVisit({
          taskId,
          urls,
          cycleCount,
          openCount,
          openInterval,
          proxyPool,
          refererOption,
          selectedSocialMedia,
          customReferer,
          startTime,
          concurrencyLimit: options.concurrencyLimit || 10,
          proxyGeoInfo: options.proxyGeoInfo,
          accessMode: options.accessMode
        });

        // 更新结果统计
        completed = normalBatchResult.completed;
        failed = normalBatchResult.failed;
        errors.push(...normalBatchResult.errors);

        logger.info('🎉 简化普通模式批量访问完成', {
          taskId,
          completed,
          failed,
          duration: normalBatchResult.duration,
          successRate: `${((completed / totalVisits) * 100).toFixed(1)}%`
        });
      }
    }

    // 任务完成 - 确保状态正确更新
    const finalCompleted = Math.min(completed, totalVisits);
    const finalFailed = Math.min(failed, totalVisits - finalCompleted);
    
    // 计算实际进度（基于成功和失败的总数）
    const actualProgress = Math.min(100, Math.round(((finalCompleted + finalFailed) / totalVisits) * 100));
    
    logger.info('任务完成，更新最终状态:', {
      taskId,
      completed: finalCompleted,
      failed: finalFailed,
      total: totalVisits,
      progress: actualProgress
    });
    
    // 检查是否所有访问都已完成
    const totalProcessed = finalCompleted + finalFailed;
    const pendingVisits = Math.max(0, totalVisits - totalProcessed);
    
    // 只有当所有访问都完成时才标记为完成
    const finalStatus = pendingVisits === 0 ? 'completed' : 'running';
    const finalProgress = Math.min(100, Math.round((totalProcessed / totalVisits) * 100));
    
    // 更新任务状态
    await silentBatchTaskManager.setTask(taskId, {
      status: finalStatus,
      progress: finalProgress,
      total: totalVisits,
      startTime,
      endTime: pendingVisits === 0 ? Date.now() : undefined,
      successCount: finalCompleted,
      failCount: finalFailed,
      pendingCount: pendingVisits,
      message: pendingVisits === 0 
        ? (() => {
            const duration = Math.floor((Date.now() - startTime) / 1000);
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            return `批量访问完成！耗时: ${minutes > 0 ? `${minutes}min${seconds}s` : `${seconds}s`}`;
          })()
        : `批量访问中...`
    });
    
    // 等待更长时间，确保最终状态更新被前端接收
    // 轮询间隔是2秒，这里等待3秒确保前端能获取到最终状态
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 生成错误摘要报告
    const errorSummary = generateErrorSummary(errors);
    if (errorSummary.hasSignificantErrors) {
      logger.warn('任务完成但存在值得关注的错误:', {
        taskId,
        errorSummary,
        successRate: `${((completed / totalVisits) * 100).toFixed(1)}%`
      });
    }

    logger.info('批量任务完成:', {
      taskId,
      completed,
      failed,
      duration: Date.now() - startTime,
      errorSummary: errorSummary.hasErrors ? errorSummary : undefined
    });

    // 清理任务执行状态标志，重新启用后台代理补充
    globalStateManager.clearExecutionFlag(taskId);
    logger.info(`任务执行完成，已重新启用后台代理补充`, { taskId });

    return {
      success: true,
      completed,
      failed,
      errors,
      duration: Date.now() - startTime,
      errorSummary
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('批量任务执行失败:', new EnhancedError('批量任务执行失败', { 
      taskId,
      error: errorMessage,
      completed,
      failed
    }));

    // 确保在异常情况下也保存进度信息
    const existingTask = silentBatchTaskManager.getTask(taskId);
    const currentProgress = existingTask?.progress || completed;
    
    // 添加最终验证
    const validatedCompleted = Math.min(completed, totalVisits);
    const validatedFailed = Math.min(failed, totalVisits - validatedCompleted);

    await silentBatchTaskManager.setTask(taskId, {
      status: 'failed',
      progress: currentProgress,
      total: totalVisits,
      startTime: existingTask?.startTime || startTime,
      endTime: Date.now(),
      successCount: validatedCompleted,
      failCount: validatedFailed,
      message: `任务执行失败: ${errorMessage}`
    });

    // 清理任务执行状态标志，重新启用后台代理补充
    globalStateManager.clearExecutionFlag(taskId);
    logger.info(`任务执行失败，已重新启用后台代理补充`, { taskId });

    return {
      success: false,
      completed,
      failed,
      errors: [errorMessage],
      duration: Date.now() - startTime
    };
  }
}

/**
 * 静默模式批量访问（简化版）
 */
async function executeSilentBatchVisit(options: {
  taskId: string;
  urls: string[];
  urlVisits: number[];
  totalVisits: number;
  proxyPool: ProxyConfig[];
  refererOption: 'social' | 'custom';
  selectedSocialMedia?: string;
  customReferer?: string;
  openInterval: number;
  startTime: number;
  enableAdvancedOptimization?: boolean;
  optimizationPreset?: 'stealth' | 'performance' | 'balanced';
  proxyGeoInfo?: any;
  accessMode?: 'http' | 'puppeteer';
}): Promise<{ completed: number; failed: number; errors: string[]; duration: number }> {
  const {
    taskId,
    urls,
    urlVisits,
    totalVisits,
    proxyPool,
    refererOption,
    selectedSocialMedia,
    customReferer,
    openInterval,
    startTime,
    enableAdvancedOptimization,
    optimizationPreset,
    proxyGeoInfo,
    accessMode
  } = options;

  logger.info('executeBatchVisitsWithSimpleConcurrency 开始执行，使用HTTP访问模式:', {
    taskId
  });

  let completed = 0;
  let failed = 0;
  const errors: string[] = [];
  let processedVisits = 0;

  // 为每个URL执行指定次数的访问
  for (let urlIndex = 0; urlIndex < urls.length; urlIndex++) {
    const url = urls[urlIndex];
    const visitCount = urlVisits[urlIndex];
    
    // 执行该URL的多次访问
    for (let visitIndex = 0; visitIndex < visitCount; visitIndex++) {
      // 检查任务是否被终止
      if (isTaskTerminated(taskId)) {
        logger.info(`任务 ${taskId} 被终止，停止批量访问`);
        return {
          completed,
          failed,
          errors,
          duration: Date.now() - startTime
        };
      }

      try {
        // 获取referer
        const referer = getReferer(refererOption, customReferer, selectedSocialMedia);
        
        // 访问URL
        const result = await visitUrlWithProxy(
          url,
          proxyPool,
          referer,
          taskId,
          processedVisits + 1,
          totalVisits,
          true, // 使用HTTP模式
          refererOption,
          undefined, // browserFingerprint
          false, // forceDirectConnection
          {
            proxyGeoInfo: options.proxyGeoInfo,
            currentRound: Math.floor(processedVisits / urls.length) + 1
          },
          accessMode
        );

        if (result.success) {
          completed++;
        } else {
          failed++;
          if (result.error) {
            errors.push(result.error);
          }
        }

        processedVisits++;
        
        // 更新进度
        const progress = Math.round((processedVisits / totalVisits) * 100);
        await silentBatchTaskManager.setTask(taskId, {
          status: 'running',
          progress,
          total: totalVisits,
          startTime: options.startTime,
          successCount: completed,
          failCount: failed,
          message: `批量访问中...`
        });

        // 如果不是最后一次访问，等待间隔时间
        if (processedVisits < totalVisits) {
          const interval = calculateInterval(openInterval);
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`访问失败: ${url}`, new EnhancedError(`访问失败: ${url}`, { error: errorMessage }));
        
        failed++;
        errors.push(errorMessage);
        processedVisits++;
      }
    }
  }

  return {
    completed,
    failed,
    errors,
    duration: Date.now() - startTime
  };
}

/**
 * 普通模式批量访问（简化版）
 */
async function executeNormalBatchVisit(options: {
  taskId: string;
  urls: string[];
  cycleCount: number;
  openCount: number;
  openInterval: number;
  proxyPool: ProxyConfig[];
  refererOption: 'social' | 'custom';
  selectedSocialMedia?: string;
  customReferer?: string;
  startTime: number;
  concurrencyLimit: number;
  enableAdvancedOptimization?: boolean;
  optimizationPreset?: 'stealth' | 'performance' | 'balanced';
  proxyGeoInfo?: any;
  accessMode?: 'http' | 'puppeteer';
}): Promise<{ completed: number; failed: number; errors: string[]; duration: number }> {
  const {
    taskId,
    urls,
    cycleCount,
    openCount,
    openInterval,
    proxyPool,
    refererOption,
    selectedSocialMedia,
    customReferer,
    startTime,
    concurrencyLimit,
    enableAdvancedOptimization,
    optimizationPreset,
    proxyGeoInfo,
    accessMode
  } = options;

  let completed = 0;
  let failed = 0;
  const errors: string[] = [];
  const totalVisits = urls.length * cycleCount * openCount;
  let processedVisits = 0;

  // 为每个轮次创建访问任务
  for (let cycle = 0; cycle < cycleCount; cycle++) {
    // 检查任务是否被终止
    if (isTaskTerminated(taskId)) {
      logger.info(`任务 ${taskId} 被终止，停止批量访问`);
      return {
        completed,
        failed,
        errors,
        duration: Date.now() - startTime
      };
    }

    // 为每个URL创建访问任务
    const visitTasks = urls?.filter(Boolean)?.map(async (url, urlIndex) => {
      const urlCompleted = completed + urlIndex * openCount;
      const urlTotal = totalVisits;
      
      // 执行指定次数的访问
      for (let i = 0; i < openCount; i++) {
        // 检查任务是否被终止
        if (isTaskTerminated(taskId)) {
          return;
        }

        try {
          // 获取referer
          const referer = getReferer(refererOption, customReferer, selectedSocialMedia);
          
          // 访问URL
          const result = await visitUrlWithProxy(
            url,
            proxyPool,
            referer,
            taskId,
            urlCompleted + i + 1,
            urlTotal,
            true, // 使用HTTP模式
            refererOption,
            undefined, // browserFingerprint
            false, // forceDirectConnection
            {
              proxyGeoInfo,
              currentRound: i + 1
            },
            accessMode
          );

          if (result.success) {
            completed++;
          } else {
            failed++;
            if (result.error) {
              errors.push(result.error);
            }
          }

          processedVisits++;
          
          // 更新进度
          const progress = Math.round((processedVisits / totalVisits) * 100);
          await silentBatchTaskManager.setTask(taskId, {
            status: 'running',
            progress,
            total: totalVisits,
            startTime: options.startTime,
            successCount: completed,
            failCount: failed,
            message: `批量访问中...`
          });

          // 如果不是最后一次访问，等待间隔时间
          if (processedVisits < totalVisits) {
            const interval = calculateInterval(openInterval);
            await new Promise(resolve => setTimeout(resolve, interval));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`访问失败: ${url}`, new EnhancedError(`访问失败: ${url}`, { error: errorMessage }));
          
          failed++;
          errors.push(errorMessage);
          processedVisits++;
        }
      }
    });

    // 并发执行URL访问
    const batchSize = Math.min(concurrencyLimit, urls.length);
    for (let i = 0; i < visitTasks.length; i += batchSize) {
      const batch = visitTasks.slice(i, i + batchSize);
      await Promise.all(batch);
    }
  }

  return {
    completed,
    failed,
    errors,
    duration: Date.now() - startTime
  };
}
