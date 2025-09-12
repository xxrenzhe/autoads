/**
 * 简化的执行服务
 * 专注于核心功能：执行自动化流程并记录结果
 */

import { localStorageService, ExecutionRecord } from './LocalStorageService';
import { simpleAdsPowerService, AdsPowerConfig } from './SimpleAdsPowerService';
import { simpleGoogleAdsService, GoogleAdsCredentials, AdToUpdate } from './SimpleGoogleAdsService';
import { simpleConfigManager, SimpleConfig } from './SimpleConfigManager';
import { EnhancedError } from '@/lib/utils/error-handling';

export interface ExecutionParams {
  configId: string;
  manualTrigger?: boolean;
}

export interface ExecutionResult {
  success: boolean;
  executionId: string;
  logs: string[];
  stats: {
    adsPowerTime: number;
    googleAdsTime: number;
    totalTime: number;
    updatedAds: number;
    failedAds: number;
  };
  error?: string;
}

class SimpleExecutionService {
  /**
   * 执行自动化流程
   */
  async executeAutomation(params: ExecutionParams): Promise<ExecutionResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    try {
      logs.push(`开始执行自动化流程 - ID: ${executionId}`);
      
      // 1. 获取配置信息
      logs.push('获取配置信息...');
      const config = await simpleConfigManager.getConfigDetails(params.configId);
      
      if (!config) {
        throw new Error('配置不存在');
      }
      
      logs.push(`配置: ${config.name}`);
      
      // 2. 获取账号信息
      logs.push('获取 Google Ads 账号信息...');
      const account = await simpleConfigManager.getAccountDetails(config.googleAdsAccountId);
      
      if (!account) {
        throw new Error('Google Ads 账号不存在');
      }
      
      logs.push(`账号: ${account.name}`);
      
      // 3. 创建执行记录
      logs.push('创建执行记录...');
      const recordId = localStorageService.saveExecution({
        configId: params.configId,
        status: 'running',
        logs: ['开始执行自动化流程']
      });
      
      // 4. 执行 AdsPower 流程
      logs.push('开始 AdsPower 流程...');
      const adsPowerStart = Date.now();
      
      const adsPowerConfig: AdsPowerConfig = {
        environmentId: config.adsPowerEnvironmentId,
        affiliateUrl: config.affiliateLink,
        openCount: 1, // 简化为固定值
        delaySeconds: 35
      };
      
      const adsPowerResult = await simpleAdsPowerService.executeAdsPowerFlow(adsPowerConfig);
      const adsPowerTime = Date.now() - adsPowerStart;
      
      logs.push(`AdsPower 执行完成，耗时: ${adsPowerTime}ms`);
      logs.push(...adsPowerResult.logs);
      
      if (!adsPowerResult.success || !adsPowerResult.finalUrl) {
        throw new Error(`AdsPower 执行失败: ${adsPowerResult.error}`);
      }
      
      // 5. 执行 Google Ads 更新
      logs.push('开始 Google Ads 更新...');
      const googleAdsStart = Date.now();
      
      const googleAdsCredentials: GoogleAdsCredentials = {
        customerId: account.customerId,
        clientId: account.clientId,
        clientSecret: account.clientSecret,
        developerToken: account.developerToken,
        refreshToken: account.refreshToken
      };
      
      // 获取账号下的所有广告
      const adsResult = await simpleGoogleAdsService.getAds(googleAdsCredentials);
      
      if (!adsResult.success || !adsResult.ads) {
        throw new Error(`获取广告列表失败: ${adsResult.error}`);
      }
      
      logs.push(`获取到 ${adsResult.ads.length} 个广告`);
      
      // 准备更新数据
      const adsToUpdate: AdToUpdate[] = adsResult.ads?.filter(Boolean)?.map(ad => ({
        adId: ad.adId,
        finalUrl: adsPowerResult.finalUrl!,
        finalUrlSuffix: adsPowerResult.finalUrlSuffix
      }));
      
      // 执行批量更新
      const updateResult = await simpleGoogleAdsService.updateAdUrls(
        googleAdsCredentials,
        adsToUpdate
      );
      
      const googleAdsTime = Date.now() - googleAdsStart;
      
      logs.push(`Google Ads 更新完成，耗时: ${googleAdsTime}ms`);
      logs.push(`更新成功: ${updateResult.updatedAds} 个，失败: ${updateResult.failedAds} 个`);
      
      if (updateResult.errors.length > 0) {
        logs.push('错误详情:');
        updateResult.errors.forEach(error => logs.push(`  - ${error}`));
      }
      
      // 6. 更新执行记录
      const totalTime = Date.now() - startTime;
      const finalLogs = [...logs, ...adsPowerResult.logs];
      
      if (updateResult.failedAds === 0) {
        finalLogs.push('✅ 自动化流程执行成功');
      } else {
        finalLogs.push('⚠️ 自动化流程部分完成');
      }
      
      localStorageService.updateExecution(recordId, {
        status: updateResult.failedAds === 0 ? 'completed' : 'failed',
        endTime: new Date().toISOString(),
        logs: finalLogs,
        result: {
          finalUrl: adsPowerResult.finalUrl,
          finalUrlSuffix: adsPowerResult.finalUrlSuffix,
          error: updateResult.failedAds > 0 ? '部分广告更新失败' : undefined
        }
      });
      
      return {
        success: updateResult.failedAds === 0,
        executionId: recordId,
        logs: finalLogs,
        stats: {
          adsPowerTime,
          googleAdsTime,
          totalTime,
          updatedAds: updateResult.updatedAds,
          failedAds: updateResult.failedAds
        }
      };
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      logs.push(`❌ 执行失败: ${errorMessage}`);
      
      // 更新执行记录为失败状态
      try {
        const executions = localStorageService.getExecutions();
        const execution = executions.find(e => e.id === executionId);
        
        if (execution) {
          localStorageService.updateExecution(execution.id, {
            status: 'failed',
            endTime: new Date().toISOString(),
            logs: [...execution.logs, ...logs],
            result: {
              error: errorMessage
            }
          });
        }
      } catch (updateError) {
        logs.push(`更新执行记录失败: ${updateError instanceof Error ? updateError.message : '未知错误'}`);
      }
      
      return {
        success: false,
        executionId,
        logs,
        stats: {
          adsPowerTime: 0,
          googleAdsTime: 0,
          totalTime,
          updatedAds: 0,
          failedAds: 0
        },
        error: errorMessage
      };
    }
  }

  /**
   * 获取执行记录
   */
  async getExecutions(limit: number = 50): Promise<ExecutionRecord[]> {
    const executions = localStorageService.getExecutions();
    return executions
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }

  /**
   * 获取执行详情
   */
  async getExecutionDetails(executionId: string): Promise<ExecutionRecord | null> {
    const executions = localStorageService.getExecutions();
    return executions.find(e => e.id === executionId) || null;
  }

  /**
   * 停止执行（简化版本）
   */
  async stopExecution(executionId: string): Promise<boolean> {
    try {
      const executions = localStorageService.getExecutions();
      const execution = executions.find(e => e.id === executionId);
      
      if (execution && execution.status === 'running') {
        localStorageService.updateExecution(executionId, {
          status: 'failed',
          endTime: new Date().toISOString(),
          logs: [...execution.logs, '执行被用户停止']
        });
        return Promise.resolve(true);
      }
      
      return Promise.resolve(false);
    } catch (error) {
      console.error('停止执行失败:', error);
      return Promise.resolve(false);
    }
  }

  /**
   * 获取执行统计
   */
  async getExecutionStats(): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    successRate: number;
  }> {
    const executions = localStorageService.getExecutions();
    
    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(e => e.status === 'completed').length;
    const failedExecutions = executions.filter(e => e.status === 'failed').length;
    
    // 计算平均执行时间
    const completedExecutions = executions.filter(e => e.endTime);
    const averageExecutionTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => {
          const duration = new Date(e.endTime!).getTime() - new Date(e.startTime).getTime();
          return sum + duration;
        }, 0) / completedExecutions.length
      : 0;

    const successRate = totalExecutions > 0 ? successfulExecutions / totalExecutions : 0;
    
    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime,
      successRate
    };
  }

  /**
   * 清理旧执行记录
   */
  async cleanupOldExecutions(daysToKeep: number = 30): Promise<void> {
    localStorageService.cleanupOldData(daysToKeep);
  }
}

export const simpleExecutionService = new SimpleExecutionService();