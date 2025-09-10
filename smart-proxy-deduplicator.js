import fs from 'fs/promises';
import path from 'path';

class SmartDeduplicator {
  constructor(options = {}) {
    this.cacheFile = options.cacheFile || path.join(process.cwd(), '.proxy-cache.json');
    this.globalUniqueProxies = new Map();
    this.sessionProxies = new Set();
    this.maxCacheSize = options.maxCacheSize || 1000;
    this.cacheExpiry = options.cacheExpiry || 24 * 60 * 60 * 1000; // 24 hours
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      await this._loadCache();
      this.initialized = true;
      console.log(`🔄 已加载 ${this.globalUniqueProxies.size} 个历史代理IP记录`);
    } catch (error) {
      console.log('📝 创建新的代理缓存文件');
      this.globalUniqueProxies = new Map();
      this.initialized = true;
    }
  }

  async deduplicate(proxies, options = {}) {
    await this.init();
    
    const {
      checkGlobal = true,        // 是否检查全局历史
      checkSession = true,       // 是否检查当前会话
      updateCache = true,        // 是否更新缓存
      returnNewOnly = false      // 是否只返回新的代理
    } = options;
    
    const uniqueProxies = [];
    const newProxies = [];
    const duplicateProxies = [];
    
    for (const proxy of proxies) {
      const proxyKey = this._getProxyKey(proxy);
      let isDuplicate = false;
      
      // 检查会话级别重复
      if (checkSession && this.sessionProxies.has(proxyKey)) {
        isDuplicate = true;
        duplicateProxies.push({ ...proxy, reason: 'session_duplicate' });
      }
      
      // 检查全局历史重复
      if (!isDuplicate && checkGlobal && this.globalUniqueProxies.has(proxyKey)) {
        const cached = this.globalUniqueProxies.get(proxyKey);
        const age = Date.now() - cached.timestamp;
        
        // 如果缓存未过期，认为是重复
        if (age < this.cacheExpiry) {
          isDuplicate = true;
          duplicateProxies.push({ 
            ...proxy, 
            reason: 'global_duplicate',
            age: Math.round(age / 1000 / 60) // minutes
          });
        } else {
          // 缓存已过期，移除旧记录
          this.globalUniqueProxies.delete(proxyKey);
        }
      }
      
      if (!isDuplicate) {
        uniqueProxies.push(proxy);
        newProxies.push(proxy);
        
        // 更新会话和全局缓存
        if (updateCache) {
          this.sessionProxies.add(proxyKey);
          this.globalUniqueProxies.set(proxyKey, {
            proxy,
            timestamp: Date.now(),
            usageCount: 1
          });
        }
      }
    }
    
    // 清理过期的缓存
    if (updateCache) {
      this._cleanupExpiredCache();
    }
    
    return {
      unique: uniqueProxies,
      new: newProxies,
      duplicates: duplicateProxies,
      stats: {
        total: proxies.length,
        unique: uniqueProxies.length,
        duplicates: duplicateProxies.length,
        duplicateRate: ((duplicateProxies.length / proxies.length) * 100).toFixed(2) + '%',
        sessionDuplicates: duplicateProxies.filter(d => d.reason === 'session_duplicate').length,
        globalDuplicates: duplicateProxies.filter(d => d.reason === 'global_duplicate').length
      }
    };
  }

  async getCacheStats() {
    await this.init();
    
    const now = Date.now();
    let expired = 0;
    let recent = 0;
    let old = 0;
    
    for (const [key, value] of this.globalUniqueProxies) {
      const age = now - value.timestamp;
      if (age > this.cacheExpiry) {
        expired++;
      } else if (age < 60 * 60 * 1000) { // Less than 1 hour
        recent++;
      } else {
        old++;
      }
    }
    
    return {
      totalCached: this.globalUniqueProxies.size,
      sessionCached: this.sessionProxies.size,
      recent: recent,
      old: old,
      expired: expired,
      hitRate: this.sessionProxies.size > 0 
        ? ((this.sessionProxies.size - recent) / this.sessionProxies.size * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  async clearCache(options = {}) {
    const { clearSession = true, clearGlobal = false, clearExpiredOnly = false } = options;
    
    if (clearSession) {
      this.sessionProxies.clear();
    }
    
    if (clearExpiredOnly) {
      this._cleanupExpiredCache();
    } else if (clearGlobal) {
      this.globalUniqueProxies.clear();
      await this._saveCache();
    }
    
    console.log('✅ 缓存已清理');
  }

  _getProxyKey(proxy) {
    // 使用完整的代理信息作为唯一标识，包括主机、端口、用户名和密码
    // 这确保了不同凭据的相同IP地址被视为不同的代理
    return `${proxy.ip}:${proxy.port}:${proxy.username || ''}:${proxy.password || ''}`;
  }

  _cleanupExpiredCache() {
    const now = Date.now();
    const toDelete = [];
    
    for (const [key, value] of this.globalUniqueProxies) {
      if (now - value.timestamp > this.cacheExpiry) {
        toDelete.push(key);
      }
    }
    
    toDelete.forEach(key => this.globalUniqueProxies.delete(key));
    
    if (toDelete.length > 0) {
      console.log(`🧹 清理了 ${toDelete.length} 个过期的代理记录`);
    }
  }

  async _loadCache() {
    try {
      const data = await fs.readFile(this.cacheFile, 'utf8');
      const parsed = JSON.parse(data);
      
      this.globalUniqueProxies = new Map(
        Object.entries(parsed).map(([key, value]) => [
          key,
          {
            ...value,
            timestamp: value.timestamp || Date.now()
          }
        ])
      );
    } catch (error) {
      // 文件不存在或格式错误，创建新的缓存
      this.globalUniqueProxies = new Map();
    }
  }

  async _saveCache() {
    try {
      const data = Object.fromEntries(this.globalUniqueProxies);
      await fs.writeFile(this.cacheFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('❌ 保存缓存失败:', error);
    }
  }
}

// 使用示例
async function testDeduplicator() {
  const deduplicator = new SmartDeduplicator({
    cacheExpiry: 60 * 60 * 1000, // 1小时过期
    maxCacheSize: 500
  });
  
  // 模拟代理列表
  const testProxies = [
    { ip: '192.168.1.1', port: 8080 },
    { ip: '192.168.1.2', port: 8080 },
    { ip: '192.168.1.1', port: 8080 }, // 重复
    { ip: '192.168.1.3', port: 8080 },
    { ip: '192.168.1.2', port: 8080 }, // 重复
  ];
  
  console.log('🧪 测试智能去重...\n');
  
  // 第一次去重
  const result1 = await deduplicator.deduplicate(testProxies);
  console.log('第一次去重结果:');
  console.log(`- 唯一代理: ${result1.stats.unique}/${result1.stats.total}`);
  console.log(`- 重复率: ${result1.stats.duplicateRate}`);
  
  // 第二次去重（应该全部重复）
  const result2 = await deduplicator.deduplicate(testProxies);
  console.log('\n第二次去重结果:');
  console.log(`- 唯一代理: ${result2.stats.unique}/${result2.stats.total}`);
  console.log(`- 重复率: ${result2.stats.duplicateRate}`);
  
  // 查看缓存统计
  const stats = await deduplicator.getCacheStats();
  console.log('\n📊 缓存统计:');
  console.log(`- 总缓存: ${stats.totalCached}`);
  console.log(`- 会话缓存: ${stats.sessionCached}`);
  console.log(`- 最近使用: ${stats.recent}`);
  console.log(`- 过期数量: ${stats.expired}`);
}

// 更新并发获取类以使用智能去重
class EnhancedConcurrentProxyAcquisition {
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || 5;
    this.delayBetweenRequests = options.delayBetweenRequests || 1000;
    this.providerConfig = {
      baseUrl: 'https://api.iprocket.io/api',
      username: 'com49692430',
      password: 'ApL72Exh03L0tgTLcb12',
      ...options.providerConfig
    };
    this.deduplicator = new SmartDeduplicator(options.deduplicatorOptions || {});
  }

  async acquireProxies(totalNeeded, ipsPerRequest = 10) {
    await this.deduplicator.init();
    
    const uniqueProxies = new Map();
    const requestsNeeded = Math.ceil(totalNeeded / ipsPerRequest);
    const concurrentBatches = Math.ceil(requestsNeeded / this.maxConcurrency);
    
    console.log(`🎯 需要获取 ${totalNeeded} 个代理IP`);
    console.log(`📊 每次请求 ${ipsPerRequest} 个IP，共需要 ${requestsNeeded} 次请求`);
    console.log(`🚀 最大并发数: ${this.maxConcurrency}`);
    
    for (let batch = 0; batch < concurrentBatches && uniqueProxies.size < totalNeeded; batch++) {
      const batchStart = batch * this.maxConcurrency;
      const batchEnd = Math.min(batchStart + this.maxConcurrency, requestsNeeded);
      const batchRequests = [];
      
      console.log(`\n📦 执行第 ${batch + 1} 批并发请求...`);
      
      // Create concurrent requests for this batch
      for (let i = batchStart; i < batchEnd && uniqueProxies.size < totalNeeded; i++) {
        const remainingNeeded = totalNeeded - uniqueProxies.size;
        const actualIpsNeeded = Math.min(ipsPerRequest, remainingNeeded);
        
        batchRequests.push(
          this._fetchAndDeduplicateProxyBatch(actualIpsNeeded, i + 1)
            .catch(error => {
              console.error(`   ❌ 请求 ${i + 1} 失败:`, error.message);
              return { unique: [], duplicates: [] };
            })
        );
        
        if (i < batchEnd - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Wait for all requests in this batch to complete
      const batchResults = await Promise.all(batchRequests);
      
      // Process results
      batchResults.forEach((result, index) => {
        const actualIndex = batchStart + index;
        console.log(`   ✅ 请求 ${actualIndex + 1}: 获取 ${result.unique.length} 个唯一IP`);
        
        if (result.duplicates.length > 0) {
          console.log(`      🔄 跳过 ${result.duplicates.length} 个重复IP`);
        }
        
        // Add to our collection
        result.unique.forEach(proxy => {
          uniqueProxies.set(proxy.ip, proxy);
        });
      });
      
      console.log(`   📈 当前累计: ${uniqueProxies.size} 个唯一IP`);
      
      if (batch < concurrentBatches - 1 && uniqueProxies.size < totalNeeded) {
        console.log(`   ⏳ 等待 ${this.delayBetweenRequests}ms 后继续...`);
        await new Promise(resolve => setTimeout(resolve, this.delayBetweenRequests));
      }
    }
    
    const finalProxies = Array.from(uniqueProxies.values());
    console.log(`\n🎉 完成！总共获取 ${finalProxies.length} 个唯一代理IP`);
    
    // Show final cache stats
    const cacheStats = await this.deduplicator.getCacheStats();
    console.log(`\n📊 缓存统计: 总计 ${cacheStats.totalCached} 个历史记录`);
    
    return {
      proxies: finalProxies,
      stats: {
        requested: totalNeeded,
        acquired: finalProxies.length,
        successRate: ((finalProxies.length / totalNeeded) * 100).toFixed(2) + '%',
        totalRequests: Math.min(requestsNeeded, Math.ceil(totalNeeded / ipsPerRequest))
      }
    };
  }

  async _fetchAndDeduplicateProxyBatch(count, requestId) {
    // Fetch raw proxies
    const rawProxies = await this._fetchProxyBatch(count, requestId);
    
    // Apply smart deduplication
    const result = await this.deduplicator.deduplicate(rawProxies, {
      checkGlobal: true,
      checkSession: true,
      updateCache: true
    });
    
    return result;
  }

  async _fetchProxyBatch(count, requestId) {
    const url = `${this.providerConfig.baseUrl}?` +
      `username=${this.providerConfig.username}&` +
      `password=${this.providerConfig.password}&` +
      `cc=ROW&ips=${count}&type=-res-&proxyType=http&responseType=json`;
    
    console.log(`   🌐 请求 ${requestId}: 获取 ${count} 个IP...`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.final || !Array.isArray(data.final)) {
      throw new Error('Invalid response format');
    }
    
    return data.final.map(item => ({
      ip: item.ip,
      port: item.port,
      username: item.username,
      password: item.password,
      full: `${item.ip}:${item.port}`
    }));
  }
}

export { SmartDeduplicator, EnhancedConcurrentProxyAcquisition };
export default EnhancedConcurrentProxyAcquisition;