import { EnhancedError } from '@/lib/utils/error-handling';
import { createClientLogger  } from "@/lib/utils/security/client-secure-logger";
// const logger = createClientLogger('MultiAccountManager');
const logger = {
  info: console.log,
  error: console.error,
  warn: console.warn
};

// 多账户管理器 - 负责批量管理多个Google Ads账户

import { 
  TrackingConfiguration, 
  GoogleAdsAccount, 
  LinkResult, 
  ExecutionResult,
  GoogleAdsCredentials,
  CampaignMapping,
  AdGroupMapping,
  AdMapping
} from '../types';

export interface BatchUpdateOptions {
  maxConcurrentAccounts: number;
  retryFailedAccounts: boolean;
  continueOnError: boolean;
  rateLimitDelay: number; // 毫秒
}

export interface AccountUpdateResult {
  accountId: string;
  accountName: string;
  success: boolean;
  updatedAdsCount: number;
  errors: string[];
  processingTime: number;
  campaignResults: CampaignUpdateResult[];
}

export interface CampaignUpdateResult {
  campaignId: string;
  campaignName: string;
  success: boolean;
  updatedAdsCount: number;
  adGroupResults: AdGroupUpdateResult[];
  errors: string[];
}

export interface AdGroupUpdateResult {
  adGroupId: string;
  adGroupName: string;
  success: boolean;
  updatedAdsCount: number;
  adResults: AdUpdateResult[];
  errors: string[];
}

export interface AdUpdateResult {
  adId: string;
  adName: string;
  success: boolean;
  oldFinalUrl?: string;
  newFinalUrl?: string;
  executionOrder: number;
  error?: string;
}

export interface BatchExecutionPlan {
  totalAccounts: number;
  totalCampaigns: number;
  totalAdGroups: number;
  totalAds: number;
  estimatedDuration: number; // 分钟
  urlDistribution: Array<{
    executionOrder: number;
    assignedAdsCount: number;
    urls: LinkResult[];
  }>;
}

export class MultiAccountManager {
  private readonly DEFAULT_OPTIONS: BatchUpdateOptions = {
    maxConcurrentAccounts: 3, // 同时处理的账户数量
    retryFailedAccounts: true,
    continueOnError: true,
    rateLimitDelay: 1000 // 1秒延迟
  };

  constructor(
    private googleAdsApiClient: unknown, // 这里需要Google Ads API客户端
    private options: Partial<BatchUpdateOptions> = {}
  ) {
    this.options = { ...this.DEFAULT_OPTIONS, ...options };
  }

  /**
   * 分析配置并生成批量执行计划
   */
  async analyzeConfiguration(
    configuration: TrackingConfiguration,
    extractedUrls: LinkResult[]
  ): Promise<BatchExecutionPlan> {
    try {
        const totalAccounts = configuration.googleAdsAccounts.length;
        let totalCampaigns = 0;
        let totalAdGroups = 0;
        let totalAds = 0;
    
        // 统计总数
        for (const account of configuration.googleAdsAccounts) {
          totalCampaigns += (account.campaignMappings || []).length;
          
          for (const campaign of account.campaignMappings || []) {
            if (campaign.adGroupMappings) {
              totalAdGroups += campaign.adGroupMappings.length;
              
              for (const adGroup of campaign.adGroupMappings) {
                totalAds += (adGroup.adMappings || []).length;
              }
            }
          }
        }
    
        // 验证URL数量与广告数量的匹配
        const allAdMappings = this.getAllAdMappings(configuration);
        const maxExecutionOrder = allAdMappings.length > 0 ? Math.max(...allAdMappings?.filter(Boolean)?.map((ad: any) => ad.executionOrder)) : 0;
        const requiredUrls = maxExecutionOrder;
        
        if (extractedUrls.length < requiredUrls) {
          throw new Error(`URL数量不足：需要${requiredUrls}个URL，但只提取到${extractedUrls.length}个`);
        }
    
        // 分析URL分配
        const urlDistribution = this.analyzeUrlDistribution(configuration, extractedUrls);
    
        // 估算执行时间（基于API调用次数和延迟）
        const estimatedApiCalls = totalAds + totalAdGroups + totalCampaigns + totalAccounts;
        const estimatedDuration = Math.ceil((estimatedApiCalls * (this.options.rateLimitDelay || 1000)) / 60000); // 转换为分钟
    
        return {
          totalAccounts,
          totalCampaigns,
          totalAdGroups,
          totalAds,
          estimatedDuration,
          urlDistribution
        };
    } catch (error) {
      console.error('Error in analyzeConfiguration:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  async createBatchExecutionPlan(
    configuration: TrackingConfiguration,
    extractedUrls: LinkResult[]
  ): Promise<BatchExecutionPlan> {
    const totalAccounts = configuration.googleAdsAccounts.length;
    let totalCampaigns = 0;
    let totalAdGroups = 0;
    let totalAds = 0;

    // 统计总数
    for (const account of configuration.googleAdsAccounts) {
      totalCampaigns += (account.campaignMappings || []).length;
      
      for (const campaign of account.campaignMappings || []) {
        if (campaign.adGroupMappings) {
          totalAdGroups += campaign.adGroupMappings.length;
          
          for (const adGroup of campaign.adGroupMappings) {
            totalAds += (adGroup.adMappings || []).length;
          }
        }
      }
    }

    // 验证URL数量与广告数量的匹配
    const allAdMappings = this.getAllAdMappings(configuration);
    const maxExecutionOrder = allAdMappings.length > 0 ? Math.max(...allAdMappings?.filter(Boolean)?.map((ad: any) => ad.executionOrder)) : 0;
    const requiredUrls = maxExecutionOrder;
    
    if (extractedUrls.length < requiredUrls) {
      throw new Error(`URL数量不足：需要${requiredUrls}个URL，但只提取到${extractedUrls.length}个`);
    }

    // 分析URL分配
    const urlDistribution = this.analyzeUrlDistribution(configuration, extractedUrls);

    // 估算执行时间（基于API调用次数和延迟）
    const estimatedApiCalls = totalAds + totalAdGroups + totalCampaigns + totalAccounts;
    const estimatedDuration = Math.ceil((estimatedApiCalls * (this.options.rateLimitDelay || 1000)) / 60000); // 转换为分钟

    return {
      totalAccounts,
      totalCampaigns,
      totalAdGroups,
      totalAds,
      estimatedDuration,
      urlDistribution
    };
  }

  /**
   * 执行批量更新
   */
  async executeBatchUpdate(
    configuration: TrackingConfiguration,
    extractedUrls: LinkResult[]
  ): Promise<{
    success: boolean;
    accountResults: AccountUpdateResult[];
    summary: {
      totalAccounts: number;
      successfulAccounts: number;
      totalAdsUpdated: number;
      totalErrors: number;
      executionTime: number;
    };
  }> {
    try {
        const startTime = Date.now();
        const accountResults: AccountUpdateResult[] = [];
    
        logger.info(`开始批量更新 ${configuration.googleAdsAccounts.length} 个Google Ads账户`);
        // 验证执行计划
        const plan = await this.createBatchExecutionPlan(configuration, extractedUrls);
      logger.info(`执行计划：${plan.totalAccounts}个账户，${plan.totalAds}个广告，预计${plan.estimatedDuration}分钟`);
        // 分批处理账户（控制并发数）
        const accountBatches = this.chunkArray(
          configuration.googleAdsAccounts, 
          this.options.maxConcurrentAccounts || 3
        );
    
        for (const batch of accountBatches) {
          const batchPromises = batch?.filter(Boolean)?.map((account: any) => 
            this.updateSingleAccount(account, extractedUrls, configuration.originalLinks)
          );
          const batchResults = await Promise.allSettled(batchPromises);
          
          batchResults.forEach((result, index: any) => {
            if (result.status === 'fulfilled') {
              accountResults.push(result.value);
            } else { // 处理失败的账户
              const failedAccount = batch[index];
              accountResults.push({
                accountId: failedAccount.accountId || '',
                accountName: failedAccount.accountName || '',
                success: false,
                updatedAdsCount: 0,
                errors: [result.reason && typeof result.reason === 'object' && 'message' in result.reason ? result.reason.message : '未知错误'],
                processingTime: 0,
                campaignResults: []
              });
            }
          });
    
          // 批次间延迟
          if (accountBatches.indexOf(batch) < accountBatches.length - 1) {
            await this.delay(this.options.rateLimitDelay || 1000);
          }
        }
    
        // 生成汇总信息
        const summary = {
          totalAccounts: accountResults.length,
          successfulAccounts: accountResults.filter((r: any) => r.success).length,
          totalAdsUpdated: accountResults.reduce((sum, r: any) => sum + r.updatedAdsCount, 0),
          totalErrors: accountResults.reduce((sum, r: any) => sum + r.errors.length, 0),
          executionTime: Date.now() - startTime
        };
    
        logger.info(`批量更新完成：${summary.successfulAccounts}/${summary.totalAccounts}个账户成功，${summary.totalAdsUpdated}个广告已更新`);
    
        return {
          success: summary.successfulAccounts > 0,
          accountResults,
          summary
        };
      } catch (error) {
      console.error('Error in executeBatchUpdate:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  /**
   * 更新单个账户
   */
  private async updateSingleAccount(
    account: GoogleAdsAccount,
    extractedUrls: LinkResult[],
    originalLinks: string[]
  ): Promise<AccountUpdateResult> {
    const startTime = Date.now();
    const campaignResults: CampaignUpdateResult[] = [];
    let totalUpdatedAds = 0;
    const errors: string[] = [];

    logger.info(`开始更新账户：${account.accountName} (${account.accountId})`);

    try {
      // 验证账户认证
      if (account.credentials) {
        await this.validateAccountCredentials(account.credentials);
      } else {
        throw new Error('账户认证信息缺失');
      }

      // 处理每个广告系列
      for (const campaign of account.campaignMappings || []) {
        try {
          const campaignResult = await this.updateCampaign(
            account,
            campaign,
            extractedUrls,
            originalLinks
          );
          
          campaignResults.push(campaignResult);
          totalUpdatedAds += campaignResult.updatedAdsCount;
          
          // 广告系列间延迟
          await this.delay((this.options.rateLimitDelay || 1000) / 2);
        } catch (error) {
          const errorMsg = `广告系列 ${campaign.campaignName} 更新失败: ${error instanceof Error ? error.message : '未知错误'}`;
          errors.push(errorMsg);
          logger.error(errorMsg);

          campaignResults.push({
            campaignId: campaign.campaignId || '',
            campaignName: campaign.campaignName || '',
            success: false,
            updatedAdsCount: 0,
            adGroupResults: [],
            errors: [errorMsg]
          });
          if (!this.options.continueOnError) {
            throw error;
          }
        }
      }

      return {
        accountId: account.accountId || '',
        accountName: account.accountName || '',
        success: errors.length === 0 || totalUpdatedAds > 0,
        updatedAdsCount: totalUpdatedAds,
        errors,
        processingTime: Date.now() - startTime,
        campaignResults
      };
    } catch (error) {
      const errorMsg = `账户 ${account.accountName} 更新失败: ${error instanceof Error ? error.message : '未知错误'}`;
      errors.push(errorMsg);
      logger.error(errorMsg);

      return {
        accountId: account.accountId || '',
        accountName: account.accountName || '',
        success: false,
        updatedAdsCount: 0,
        errors,
        processingTime: Date.now() - startTime,
        campaignResults
      };
    }
  }

  /**
   * 更新单个广告系列
   */
  private async updateCampaign(
    account: GoogleAdsAccount,
    campaign: CampaignMapping,
    extractedUrls: LinkResult[],
    originalLinks: string[]
  ): Promise<CampaignUpdateResult> {
    const adGroupResults: AdGroupUpdateResult[] = [];
    let totalUpdatedAds = 0;
    const errors: string[] = [];

    logger.info(`更新广告系列：${campaign.campaignName}`);

    // 检查原始链接匹配
    const matchingLinks = originalLinks.filter((link: any) => 
      campaign.originalUrlPattern && link.includes(campaign.originalUrlPattern)
    );
    if (matchingLinks.length === 0) {
      const errorMsg = `广告系列 ${campaign.campaignName} 没有匹配的原始链接模式: ${campaign.originalUrlPattern}`;
      errors.push(errorMsg);
      logger.warn(errorMsg);
    }

    // 处理广告组
    if (campaign.adGroupMappings) {
      for (const adGroup of campaign.adGroupMappings) {
        try {
          const adGroupResult = await this.updateAdGroup(
            account,
            campaign,
            adGroup,
            extractedUrls
          );
          
          adGroupResults.push(adGroupResult);
          totalUpdatedAds += adGroupResult.updatedAdsCount;
          
          // 广告组间延迟
          await this.delay((this.options.rateLimitDelay || 1000) / 4);
        } catch (error) {
          const errorMsg = `广告组 ${adGroup.adGroupName} 更新失败: ${error instanceof Error ? error.message : '未知错误'}`;
          errors.push(errorMsg);
          logger.error(errorMsg);

          adGroupResults.push({
            adGroupId: adGroup.adGroupId || '',
            adGroupName: adGroup.adGroupName || '',
            success: false,
            updatedAdsCount: 0,
            adResults: [],
            errors: [errorMsg]
          });
          if (!this.options.continueOnError) {
            throw error;
          }
        }
      }
    }

    return {
      campaignId: campaign.campaignId || '',
      campaignName: campaign.campaignName || '',
      success: errors.length === 0 || totalUpdatedAds > 0,
      updatedAdsCount: totalUpdatedAds,
      adGroupResults,
      errors
    };
  }

  /**
   * 更新单个广告组
   */
  private async updateAdGroup(
    account: GoogleAdsAccount,
    campaign: CampaignMapping,
    adGroup: AdGroupMapping,
    extractedUrls: LinkResult[]
  ): Promise<AdGroupUpdateResult> {
    const adResults: AdUpdateResult[] = [];
    let totalUpdatedAds = 0;
    const errors: string[] = [];

    logger.info(`更新广告组：${adGroup.adGroupName}`);

    // 处理每个广告
    for (const adMapping of adGroup.adMappings || []) {
      try {
        const adResult = await this.updateSingleAd(
          account,
          campaign,
          adGroup,
          adMapping,
          extractedUrls
        );
        
        adResults.push(adResult);
        if (adResult.success) {
          totalUpdatedAds++;
        }
        
        // 广告间延迟
        await this.delay((this.options.rateLimitDelay || 1000) / 8);
      } catch (error) {
        const errorMsg = `广告 ${adMapping.adName} 更新失败: ${error instanceof Error ? error.message : '未知错误'}`;
        errors.push(errorMsg);
        logger.error(errorMsg);

        adResults.push({
          adId: adMapping.adId || '',
          adName: adMapping.adName || '',
          success: false,
          executionOrder: adMapping.executionOrder,
          error: errorMsg
        });
        if (!this.options.continueOnError) {
          throw error;
        }
      }
    }

    return {
      adGroupId: adGroup.adGroupId || '',
      adGroupName: adGroup.adGroupName || '',
      success: errors.length === 0 || totalUpdatedAds > 0,
      updatedAdsCount: totalUpdatedAds,
      adResults,
      errors
    };
  }

  /**
   * 更新单个广告
   */
  private async updateSingleAd(
    account: GoogleAdsAccount,
    campaign: CampaignMapping,
    adGroup: AdGroupMapping,
    adMapping: AdMapping,
    extractedUrls: LinkResult[]
  ): Promise<AdUpdateResult> {
    logger.info(`更新广告：${adMapping.adName} (执行顺序: ${adMapping.executionOrder})`);

    // 根据执行顺序找到对应的URL
    const targetUrl = extractedUrls.find((url: any) => url.executionOrder === adMapping.executionOrder);
    
    if (!targetUrl) {
      throw new Error(`找不到执行顺序为 ${adMapping.executionOrder} 的URL`);
    }

    if (targetUrl.status !== 'success') {
      throw new Error(`执行顺序为 ${adMapping.executionOrder} 的URL提取失败: ${targetUrl.error}`);
    }

    // 构建新的Final URL
    const newFinalUrl = (targetUrl.finalUrlBase || targetUrl.finalUrl || '') + (targetUrl.parameters ? `?${targetUrl.parameters}` : '');

    try {
      // 获取当前广告信息
      // Note: This is a mock implementation - replace with actual Google Ads API calls
      const currentAd = await this.getAdInfo(account.accountId || '', adMapping.adId || '');

      const oldFinalUrl = currentAd.finalUrl || '';

      // 更新广告的Final URL
      await this.updateAdFinalUrl(account.accountId || '', adMapping.adId || '', newFinalUrl);

      logger.info(`广告 ${adMapping.adName} 更新成功: ${oldFinalUrl} -> ${newFinalUrl}`);

      return {
        adId: adMapping.adId || '',
        adName: adMapping.adName || '',
        success: true,
        oldFinalUrl,
        newFinalUrl,
        executionOrder: adMapping.executionOrder
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      logger.error('广告 ${adMapping.adName} 更新失败:', new EnhancedError('广告 ${adMapping.adName} 更新失败:', { error: errorMsg  }));
      return {
        adId: adMapping.adId || '',
        adName: adMapping.adName || '',
        success: false,
        executionOrder: adMapping.executionOrder,
        error: errorMsg
      };
    }
  }

  /**
   * 验证账户认证信息
   */
  private async validateAccountCredentials(credentials: GoogleAdsCredentials): Promise<void> {
    try {
      // Mock authentication - replace with actual implementation
      logger.info('Validating account credentials');
      if (!credentials.clientId || !credentials.clientSecret || !credentials.developerToken) {
        throw new Error('Missing required credentials');
      }
    } catch (error) {
      throw new Error(`账户认证失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * Mock method to get ad info
   */
  private async getAdInfo(accountId: string, adId: string): Promise<{ finalUrl?: string }> {
    // Mock implementation
    return { finalUrl: 'https://example.com/original-url' };
  }

  /**
   * Mock method to update ad final URL
   */
  private async updateAdFinalUrl(accountId: string, adId: string, newFinalUrl: string): Promise<void> {
    // Mock implementation
    logger.info(`Updating ad ${adId} final URL to: ${newFinalUrl}`);
  }

  /**
   * 分析URL分配情况
   */
  private analyzeUrlDistribution(
    configuration: TrackingConfiguration,
    extractedUrls: LinkResult[]
  ): Array<{
    executionOrder: number;
    assignedAdsCount: number;
    urls: LinkResult[];
  }> {
    const distribution = new Map<number, { count: number; urls: LinkResult[] }>();

    // 统计每个执行顺序对应的广告数量
    for (const account of configuration.googleAdsAccounts) {
      for (const campaign of account.campaignMappings || []) {
        if (campaign.adGroupMappings) {
          for (const adGroup of campaign.adGroupMappings) {
            for (const ad of adGroup.adMappings || []) {
              const existing = distribution.get(ad.executionOrder) || { count: 0, urls: [] };
              existing.count++;
              distribution.set(ad.executionOrder, existing);
            }
          }
        }
      }
    }

    // 分配URL到对应的执行顺序
    for (const url of extractedUrls) {
      if (url.executionOrder !== undefined) {
        const existing = distribution.get(url.executionOrder);
        if (existing) {
          existing.urls.push(url);
        }
      }
    }

    return Array.from(distribution.entries()).map(([executionOrder, data]: any) => ({
      executionOrder,
      assignedAdsCount: data.count,
      urls: data.urls
    }));
  }

  /**
   * 获取所有广告映射
   */
  private getAllAdMappings(configuration: TrackingConfiguration): AdMapping[] {
    const allAds: AdMapping[] = [];

    for (const account of configuration.googleAdsAccounts) {
      for (const campaign of account.campaignMappings || []) {
        if (campaign.adGroupMappings) {
          for (const adGroup of campaign.adGroupMappings) {
            allAds.push(...(adGroup.adMappings || []));
          }
        }
      }
    }

    return allAds;
  }

  /**
   * 数组分块
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 生成批量更新报告
   */
  generateBatchReport(
    configuration: TrackingConfiguration,
    accountResults: AccountUpdateResult[]
  ): string {
    const lines: string[] = [];
    
    lines.push('=== Google Ads批量更新报告 ===');
    lines.push(`配置名称: ${configuration.name}`);
    lines.push(`执行时间: ${new Date().toLocaleString()}`);
    lines.push('');

    // 汇总信息
    const totalAccounts = accountResults.length;
    const successfulAccounts = accountResults.filter((r: any) => r.success).length;
    const totalAdsUpdated = accountResults.reduce((sum, r: any) => sum + r.updatedAdsCount, 0);
    const totalErrors = accountResults.reduce((sum, r: any) => sum + r.errors.length, 0);

    lines.push('=== 汇总信息 ===');
    lines.push(`总账户数: ${totalAccounts}`);
    lines.push(`成功账户: ${successfulAccounts}`);
    lines.push(`更新广告数: ${totalAdsUpdated}`);
    lines.push(`错误数量: ${totalErrors}`);
    lines.push(`成功率: ${((successfulAccounts / totalAccounts) * 100).toFixed(1)}%`);
    lines.push('');

    // 详细结果
    lines.push('=== 详细结果 ===');
    accountResults.forEach((result, index: any) => {
      lines.push(`${index + 1}. 账户: ${result.accountName} (${result.accountId})`);
      lines.push(`   状态: ${result.success ? '成功' : '失败'}`);
      lines.push(`   更新广告数: ${result.updatedAdsCount}`);
      lines.push(`   处理时间: ${Math.round(result.processingTime / 1000)}秒`);
      
      if (result.errors.length > 0) {
        lines.push(`   错误信息:`);
        result.errors.forEach((error: any) => {
          lines.push(`     - ${error}`);
        });
      }
      
      lines.push('');
    });

    return lines.join('\n');
  }
}