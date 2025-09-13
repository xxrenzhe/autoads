'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Trash2, 
  Link, 
  Target, 
  AlertCircle,
  CheckCircle,
  Settings
} from 'lucide-react';
import { SecureConfigurationManager } from '../models/SecureConfigurationManager';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
// TODO: Fix GoogleAdsCredentials type import
// import { GoogleAdsCredentials } from '../models/SecureConfigurationManager';

const logger = createClientLogger('ad-mapping-config');

interface AdMapping {
  adId: string;
  adName: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  executionNumber: number;
}

interface LinkAdMapping {
  originalUrl: string;
  adMappings: AdMapping[];
}

interface AdMappingConfigProps {
  originalLinks: string[];
  adMappingConfig: LinkAdMapping[];
  onAdMappingChange: (config: LinkAdMapping[]) => void;
}

export default function AdMappingConfig({ 
  originalLinks, 
  adMappingConfig, 
  onAdMappingChange 
}: AdMappingConfigProps) {
  const [googleAdsAccounts, setGoogleAdsAccounts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [adGroups, setAdGroups] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [_, setLoading] = useState(false);

  // const secureManager = SecureConfigurationManager.getInstance();

  useEffect(() => {
    loadGoogleAdsAccounts();
  }, []);

  useEffect(() => {
    // 当原始链接变化时，更新映射配置
    const updatedConfig = originalLinks?.filter(Boolean)?.map((url: any) => {
      const existing = adMappingConfig.find((config: any) => config.originalUrl === url);
      return existing || { originalUrl: url, adMappings: [] };
    });
    onAdMappingChange(updatedConfig);
  }, [originalLinks]);
  const loadGoogleAdsAccounts = async () => {
    try {
      // SecureConfigurationManager没有getGoogleAdsCredentials方法
      // 使用模拟数据
      const accountList = [
        {
          id: 'mock_account_1',
          accountId: '123456789',
          accountName: 'Google Ads 账户 1',
          status: 'active'
        }
      ];
      setGoogleAdsAccounts(accountList);
      
      // 加载第一个账户的广告系列
      if (accountList.length > 0) {
        await loadCampaigns(accountList[0].accountId);
      }
    } catch (error) {
      logger.error('加载Google Ads账户失败:', new EnhancedError('加载Google Ads账户失败:', { error: error instanceof Error ? error.message : String(error)  }));
    }
  };

  const loadCampaigns = async (accountId: string) => {
    try {
      setLoading(true);
      // 模拟加载广告系列数据
      const mockCampaigns = [
        { id: 'campaign_1', name: '夏季促销活动', status: 'ENABLED' },
        { id: 'campaign_2', name: '品牌推广', status: 'ENABLED' },
        { id: 'campaign_3', name: '产品发布', status: 'PAUSED' }
      ];
      setCampaigns(mockCampaigns);
      
      // 加载第一个广告系列的广告组
      if (mockCampaigns.length > 0) {
        await loadAdGroups(accountId, mockCampaigns[0].id);
      }
    } catch (error) {
      logger.error('加载广告系列失败:', new EnhancedError('加载广告系列失败:', { error: error instanceof Error ? error.message : String(error)  }));
    } finally {
      setLoading(false);
    }
  };

  const loadAdGroups = async (accountId: string, _campaignId: string) => {
    try {
      // 模拟加载广告组数据
      const mockAdGroups = [
        { id: 'adgroup_1', name: '关键词组1', status: 'ENABLED' },
        { id: 'adgroup_2', name: '关键词组2', status: 'ENABLED' },
        { id: 'adgroup_3', name: '品牌词组', status: 'ENABLED' }
      ];
      setAdGroups(mockAdGroups);
      
      // 加载第一个广告组的广告
      if (mockAdGroups.length > 0) {
        await loadAds(accountId, mockAdGroups[0].id);
      }
    } catch (error) {
      logger.error('加载广告组失败:', new EnhancedError('加载广告组失败:', { error: error instanceof Error ? error.message : String(error)  }));
    }
  };

  const loadAds = async (_accountId: string, _adGroupId: string) => {
    try {
      // 模拟加载广告数据
      const mockAds = [
        { id: 'ad_1', name: '响应式搜索广告1', status: 'ENABLED', finalUrl: 'https://example.com/product1' },
        { id: 'ad_2', name: '响应式搜索广告2', status: 'ENABLED', finalUrl: 'https://example.com/product2' },
        { id: 'ad_3', name: '文字广告1', status: 'ENABLED', finalUrl: 'https://example.com/landing' }
      ];
      setAds(mockAds);
    } catch (error) {
      logger.error('加载广告失败:', new EnhancedError('加载广告失败:', { error: error instanceof Error ? error.message : String(error)  }));
    }
  };

  const addAdMapping = (linkIndex: number) => {
    const updatedConfig = [...adMappingConfig];
    const newMapping: AdMapping = {
      adId: '',
      adName: '',
      campaignId: '',
      campaignName: '',
      adGroupId: '',
      adGroupName: '',
      executionNumber: 1
    };
    
    if (!updatedConfig[linkIndex]) {
      updatedConfig[linkIndex] = {
        originalUrl: originalLinks[linkIndex],
        adMappings: []
      };
    }
    
    updatedConfig[linkIndex].adMappings.push(newMapping);
    onAdMappingChange(updatedConfig);
  };

  const removeAdMapping = (linkIndex: number, mappingIndex: number) => {
    const updatedConfig = [...adMappingConfig];
    updatedConfig[linkIndex].adMappings.splice(mappingIndex, 1);
    onAdMappingChange(updatedConfig);
  };

  const updateAdMapping = (linkIndex: number, mappingIndex: number, field: keyof AdMapping, value: any) => {
    const updatedConfig = [...adMappingConfig];
    updatedConfig[linkIndex].adMappings[mappingIndex] = {
      ...updatedConfig[linkIndex].adMappings[mappingIndex],
      [field]: value
    };
    onAdMappingChange(updatedConfig);
  };

  const handleAdSelection = (linkIndex: number, mappingIndex: number, adId: string) => {
    const selectedAd = ads.find((ad: any) => ad.id === adId);
    const selectedAdGroup = adGroups.find((ag: any) => ag.id === selectedAd?.adGroupId);
    const selectedCampaign = campaigns.find((c: any) => c.id === selectedAdGroup?.campaignId);

    if (selectedAd) {
      const updatedConfig = [...adMappingConfig];
      updatedConfig[linkIndex].adMappings[mappingIndex] = {
        ...updatedConfig[linkIndex].adMappings[mappingIndex],
        adId: selectedAd.id,
        adName: selectedAd.name,
        campaignId: selectedCampaign?.id || '',
        campaignName: selectedCampaign?.name || '',
        adGroupId: selectedAdGroup?.id || '',
        adGroupName: selectedAdGroup?.name || ''
      };
      onAdMappingChange(updatedConfig);
    }
  };

  if (originalLinks.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          请先添加广告联盟链接，然后配置与Google Ads的映射关系。
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-medium">广告映射配置</h3>
      </div>

      {googleAdsAccounts.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            请先在"账号管理"中添加并授权Google Ads账户。
          </AlertDescription>
        </Alert>
      )}

      {originalLinks.map((link, linkIndex: any) => (
        <Card key={linkIndex}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  广告联盟链接 {linkIndex + 1}
                </CardTitle>
                <CardDescription className="break-all">
                  {link}
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => addAdMapping(linkIndex)}
                disabled={googleAdsAccounts.length === 0}
              >
                <Plus className="h-4 w-4 mr-1" />
                添加广告映射
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {adMappingConfig[linkIndex]?.adMappings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>暂无广告映射配置</p>
                <p className="text-sm">点击"添加广告映射"开始配置</p>
              </div>
            ) : (
              <div className="space-y-4">
                {adMappingConfig[linkIndex]?.adMappings.map((mapping, mappingIndex: any) => (
                  <div key={mappingIndex} className="border rounded-lg p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">映射配置 {mappingIndex + 1}</h4>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => removeAdMapping(linkIndex, mappingIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>选择广告</Label>
                        <Select
                          value={mapping.adId}
                          onValueChange={(value) => handleAdSelection(linkIndex, mappingIndex, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择要更新的广告" />
                          </SelectTrigger>
                          <SelectContent>
                            {ads.map((ad: any) => (
                              <SelectItem key={ad.id} value={ad.id}>
                                {ad.name} ({ad.status})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>执行次数</Label>
                        <Select
                          value={mapping.executionNumber.toString()}
                          onValueChange={((value: any): any) => updateAdMapping(linkIndex, mappingIndex, 'executionNumber', parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 10 }, (_, i) => i + 1).map((num: any) => (
                              <SelectItem key={num} value={num.toString()}>
                                第 {num} 次执行
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {mapping.adId && (
                      <div className="bg-gray-50 p-3 rounded space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium">映射详情</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">广告系列:</span>
                            <span className="ml-2">{mapping.campaignName}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">广告组:</span>
                            <span className="ml-2">{mapping.adGroupName}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">广告:</span>
                            <span className="ml-2">{mapping.adName}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">执行次数:</span>
                            <Badge className="ml-2">第 {mapping.executionNumber} 次</Badge>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>映射说明：</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• 每个广告联盟链接可以映射到多个Google Ads广告</li>
            <li>• 执行次数决定在第几次访问时更新对应的广告</li>
            <li>• 系统会自动提取最终URL并分离为Final URL和Final URL suffix</li>
            <li>• 确保选择的广告状态为"已启用"以便正常更新</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
