/**
 * 使用示例：优化后的代理IP批量获取
 */

import { IPRocketBatchFetcher } from './src/lib/services/iprocket-batch-fetcher';

async function exampleUsage() {
  // 1. 创建获取器实例
  const fetcher = new IPRocketBatchFetcher({
    maxConcurrent: 2,        // 最大并发数
    batchSize: 10,          // 每批获取数量
    maxRetries: 3,          // 最大重试次数
    baseDelay: 1000,        // 基础延迟
    sessionMultiplier: 3,   // 每个IP的平均会话数
    poolSizeEstimate: 10    // 估计的IP池大小
  });

  // 2. IPRocket API URL
  const proxyUrl = 'https://api.iprocket.io/api?username=YOUR_USERNAME&password=YOUR_PASSWORD&cc=ROW&ips=100&type=-res-&proxyType=socks5&responseType=txt';

  try {
    // 3. 使用优化版本批量获取
    console.log('开始获取代理...');
    const proxies = await fetcher.batchFetchOptimized(
      proxyUrl,
      50,  // 目标获取50个唯一代理
      true // 使用浏览器模拟
    );

    console.log(`成功获取 ${proxies.length} 个代理`);
    
    // 4. 使用代理
    proxies.forEach((proxy, index) => {
      console.log(`${index + 1}. ${proxy.host}:${proxy.port} (Session: ${proxy.sid})`);
      // 代理格式: host:port:username:password
      const proxyString = proxy.full;
      // 或者使用HTTP格式: http://username:password@host:port
      const httpProxy = proxy.httpUrl;
    });

  } catch (error) {
    console.error('获取代理失败:', error);
  }
}

// 运行示例
// exampleUsage();