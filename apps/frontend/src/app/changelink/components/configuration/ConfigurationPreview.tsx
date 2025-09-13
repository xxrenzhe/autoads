'use client';

import { useState } from 'react';
import { 
  Clock, 
  Link, 
  Settings, 
  Play, 
  Mail, 
  Hash, 
  Target,
  CheckCircle,
  AlertCircle,
  Info,
  X,
  Download,
  Copy
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { TrackingConfiguration, GoogleAdsAccount } from '../../types';
import { ConfigurationValidator } from '../../models/ConfigurationValidator';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createClientLogger('ConfigurationPreview');


interface ConfigurationPreviewProps {
  configuration: Partial<TrackingConfiguration>;
  googleAdsAccounts: GoogleAdsAccount[];
  onClose: () => void;
  onEdit: () => void;
  onSave: () => void;
  isOpen: boolean;
}

export default function ConfigurationPreview({
  configuration,
  googleAdsAccounts,
  onClose,
  onEdit,
  onSave,
  isOpen
}: .*Props) {
  const [activeTab, setActiveTab] = useState('overview');
  const validator = new ConfigurationValidator();

  if (!isOpen) return null as any;

  // 验证配置
  const validationResult = validator.validateConfiguration(configuration);
  // const executionEstimate = validator.estimateExecutionTime(configuration);
  
  // 临时执行时间估算
  const executionEstimate = {
    totalTime: 0,
    breakdown: {
      linkProcessing: 0,
      googleAdsUpdates: 0,
      overhead: 0
    }
  };

  // 获取映射的广告信息
  const getMappedAds = () => {
    const mappedAds: Array<{
      id: string;
      name: string;
      accountName: string;
      campaignName: string;
      adGroupName: string;
      mappingCount: number;
    }> = [];

    if (!configuration.adMappingConfig) return mappedAds;

    const adCounts = new Map<string, number>();
    
    for (const mapping of configuration.adMappingConfig) => {
      if (Array.isArray(mapping.adMappings)) => {
        mapping.adMappings.forEach((ad: any) => {
          const adId = ad.adId;
          adCounts.set(adId, (adCounts.get(adId) || 0) + 1);
        });
      }
    }

    googleAdsAccounts.forEach((account => { account.campaignMappings?.forEach(campaign: any) => {
        campaign.adGroupMappings?.forEach((adGroup: any) => {
          adGroup.adMappings?.forEach((ad: any) => {
            if (ad.adId) => {
              const count = adCounts.get(ad.adId);
              if (count && count > 0) => {
                mappedAds.push({
                  id: ad.adId,
                  name: ad.adName || 'Unknown Ad',
                  accountName: account.accountName || 'Unknown Account',
                  campaignName: campaign.campaignName || 'Unknown Campaign',
                  adGroupName: adGroup.adGroupName || 'Unknown Ad Group',
                  mappingCount: count
               });
              }
            }
          });
        });
      });
    });

    return mappedAds;
  };

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) => {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) => {
      return `${minutes}分钟${secs}秒`;
    } else {
      return `${secs}秒`;
    }
  };

  // 导出配置
  const handleExportConfig = () => {
    const configData = {
      ...configuration,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${configuration.name || 'config'}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 复制配置到剪贴板
  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(configuration, null, 2));
      // 这里可以添加成功提示
    } catch (error) { 
      logger.error('Failed to copy configuration:', new EnhancedError('Failed to copy configuration:', { error: error instanceof Error ? error.message : String(error)  }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">配置预览</h2>
            <p className="text-gray-600 text-sm mt-1">{configuration.name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportConfig}>
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyConfig}>
              <Copy className="h-4 w-4 mr-2" />
              复制
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit}>
              编辑
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 验证状态 */}
        <div className="p-4 border-b">
          <Alert className={validationResult.valid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            {validationResult.valid ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={validationResult.valid ? 'text-green-700' : 'text-red-700'}>
              {validationResult.message}
            </AlertDescription>
          </Alert>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid grid-cols-4 mx-6 mt-4">
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="links">链接配置</TabsTrigger>
              <TabsTrigger value="mapping">映射关系</TabsTrigger>
              <TabsTrigger value="execution">执行计划</TabsTrigger>
            </TabsList>

            <div className="p-6">
              {/* 概览 */}
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        基础信息
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">配置名称:</span>
                        <span className="font-medium">{configuration.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">环境ID:</span>
                        <span className="font-mono text-xs">{configuration.environmentId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">重复次数:</span>
                        <span className="font-medium">{configuration.repeatCount}次</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">环境ID:</span>
                        <span className="font-mono text-xs">{configuration.environmentId || '未设置'}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        统计信息
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">原始链接:</span>
                        <span className="font-medium">
                          {configuration.originalLinks?.filter((l: any) => l.trim()).length || 0}个
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">链接映射:</span>
                        <span className="font-medium">
                          {configuration.adMappingConfig?.length || 0}个
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">目标广告:</span>
                        <span className="font-medium">{getMappedAds().length}个</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">总执行次数:</span>
                        <span className="font-medium">
                          {(configuration.originalLinks?.filter((l: any) => l.trim()).length || 0) * (configuration.repeatCount || 1)}次
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 配置描述部分已移除，因为TrackingConfiguration类型中没有description字段 */}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      执行时间估算
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">预计总时间:</span>
                      <Badge variant="outline" className="text-blue-600">
                        {formatTime(executionEstimate.totalTime)}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>链接处理:</span>
                        <span>{formatTime(executionEstimate.breakdown.linkProcessing)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>广告更新:</span>
                        <span>{formatTime(executionEstimate.breakdown.googleAdsUpdates)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>系统开销:</span>
                        <span>{formatTime(executionEstimate.breakdown.overhead)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 链接配置 */}
              <TabsContent value="links" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Link className="h-4 w-4" />
                      原始链接列表 ({configuration.originalLinks?.filter((l: any) => l.trim()).length || 0}个)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {configuration.originalLinks?.filter((l: any) => l.trim()).map((link, index: any) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                          <span className="text-gray-500 font-mono text-xs w-6">{index + 1}.</span>
                          <span className="font-mono text-xs break-all flex-1">{link}</span>
                          <Badge variant="outline" className="text-xs">
                            {configuration.repeatCount}次
                          </Badge>
                        </div>
                      )) || (
                        <p className="text-gray-500 text-sm">暂无链接配置</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 映射关系 */}
              <TabsContent value="mapping" className="space-y-4">
                {configuration.adMappingConfig && configuration.adMappingConfig.length > 0 ? (
                  <div className="space-y-4">
                    {configuration.adMappingConfig.map((mapping, index: any) => (
                      <Card key={index}>
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-center">
                            <CardTitle className="text-sm">映射 {index + 1}</CardTitle>
                            <div className="flex gap-2">
                              <Badge variant="outline">映射配置</Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">原始链接:</p>
                            <p className="font-mono text-xs bg-gray-50 p-2 rounded break-all">
                              {mapping.originalUrl}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-xs text-gray-600 mb-2">
                              目标广告 ({mapping.adMappings?.length || 0}个):
                            </p>
                            <div className="space-y-1">
                              {mapping.adMappings?.map((adMapping, idx: any) => {
                                const mappedAd = getMappedAds().find((a: any) => a.id === adMapping.adId);
                                return mappedAd ? (
                                  <div key={adMapping.adId} className="text-xs bg-blue-50 p-2 rounded">
                                    <p className="font-medium">{mappedAd.name}</p>
                                    <p className="text-gray-600">
                                      {mappedAd.accountName} → {mappedAd.campaignName} → {mappedAd.adGroupName}
                                    </p>
                                  </div>
                                ) : (
                                  <div key={adMapping.adId} className="text-xs bg-red-50 p-2 rounded text-red-700">
                                    广告ID: {adMapping.adId} (未找到)
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="text-center py-8">
                      <Target className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">暂无链接映射配置</p>
                      <p className="text-xs text-gray-400 mt-1">
                        链接映射用于指定每个原始链接对应的Google Ads广告
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* 执行计划 */}
              <TabsContent value="execution" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      执行流程
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded">
                        <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">启动AdsPower环境</p>
                          <p className="text-xs text-gray-600">环境ID: {configuration.environmentId}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded">
                        <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">处理原始链接</p>
                          <p className="text-xs text-gray-600">
                            {configuration.originalLinks?.filter((l: any) => l.trim()).length || 0}个链接 × {configuration.repeatCount}次 = 
                            {(configuration.originalLinks?.filter((l: any) => l.trim()).length || 0) * (configuration.repeatCount || 1)}次执行
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 bg-purple-50 rounded">
                        <div className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">更新Google Ads</p>
                          <p className="text-xs text-gray-600">
                            更新{getMappedAds().length}个广告的最终URL和参数
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 bg-orange-50 rounded">
                        <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">环境配置</p>
                          <p className="text-xs text-gray-600">环境ID: {configuration.environmentId || '未设置'}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>执行说明:</strong> 每个原始链接会被重复执行{configuration.repeatCount}次，
                    系统会按照执行顺序将获得的最终URL分配给对应的Google Ads广告。
                    整个过程预计需要{formatTime(executionEstimate.totalTime)}。
                  </AlertDescription>
                </Alert>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* 底部操作 */}
        <div className="flex justify-between items-center p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {validationResult.valid ? (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                配置验证通过，可以保存执行
              </span>
            ) : (
              <span className="text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                配置存在问题，请修改后再保存
              </span>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              关闭
            </Button>
            <Button variant="outline" onClick={onEdit}>
              编辑配置
            </Button>
            <Button 
              onClick={onSave} 
              disabled={!validationResult.valid}
              className={validationResult.valid ? '' : 'opacity-50 cursor-not-allowed'}
            >
              保存配置
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}