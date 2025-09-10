'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Link,
  Settings,
  Play,
  Save,
  X,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

import { TrackingConfiguration, GoogleAdsAccount, LinkMapping } from '../../types';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
const logger = createClientLogger('AdsPowerConfigForm');

const linkMappingSchema = z.object({
  originalUrl: z.string().url('请输入有效的URL'),
  targetAdIds: z.array(z.string()).min(1, '至少需要选择一个广告'),
  priority: z.number().int().min(1, '优先级必须大于0').max(10, '优先级不能超过10'),
  enabled: z.boolean()
});

const adsPowerConfigSchema = z.object({
  name: z.string().min(3, '配置名称至少需要3个字符').max(50, '配置名称最多50个字符'),
  environmentId: z.string().min(1, 'AdsPower环境ID不能为空'),
  repeatCount: z.number().int().min(1, '重复次数必须大于0').max(10, '重复次数不能超过10'),
  notificationEmail: z.string().email('请输入有效的邮箱地址'),
  originalLinks: z.array(z.string().url('请输入有效的URL')).min(1, '至少需要一个原始链接'),
  linkMappings: z.array(linkMappingSchema).optional(),
  description: z.string().optional()
});
type AdsPowerConfigFormValues = z.infer<typeof adsPowerConfigSchema>;

interface AdsPowerConfigFormProps {
  initialData?: Partial<TrackingConfiguration>;
  googleAdsAccounts: GoogleAdsAccount[];
  onSubmit: (data: AdsPowerConfigFormValues) => void;
  onCancel: () => void;
  onPreview: (data: AdsPowerConfigFormValues) => void;
  onValidateEnvironment: (environmentId: string) => Promise<boolean>;
  onTestLinks: (links: string[]) => Promise<{ url: string; valid: boolean; error?: string }[]>;
  isSubmitting?: boolean;
}

export default function AdsPowerConfigForm({
  initialData,
  googleAdsAccounts,
  onSubmit,
  onCancel,
  onPreview,
  onValidateEnvironment,
  onTestLinks,
  isSubmitting = false
}: AdsPowerConfigFormProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [environmentValidation, setEnvironmentValidation] = useState<{
    status: 'idle' | 'validating' | 'valid' | 'invalid';
    message?: string;
  }>({ status: 'idle' });

  const [linkValidation, setLinkValidation] = useState<{
    status: 'idle' | 'validating' | 'valid' | 'invalid';
    results?: { url: string; valid: boolean; error?: string }[];
  }>({ status: 'idle' });
  const [showPreview, setShowPreview] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // 默认值
  const defaultValues: Partial<AdsPowerConfigFormValues> = {
    ...initialData,
    name: '',
    environmentId: '',
    repeatCount: 3,
    notificationEmail: '',
    originalLinks: [''],
    linkMappings: (initialData?.adMappingConfig || [])?.filter(Boolean)?.map(m => ({
      originalUrl: typeof m.originalUrl === 'string' ? m.originalUrl : '',
      targetAdIds: Array.isArray(m.adMappings) ? m.adMappings?.filter(Boolean)?.map(ad => ad.adId) : [],
      priority: 1,
      enabled: true,
    })),
    description: '',
  };

  // 表单设置
  const form = useForm<AdsPowerConfigFormValues>({
    defaultValues,
    mode: 'onChange',
    resolver: zodResolver(adsPowerConfigSchema)
  });
  // 步骤配置
  const steps = [
    { id: 1, title: '基础配置', tab: 'basic', required: true },
    { id: 2, title: '链接配置', tab: 'links', required: true },
    { id: 3, title: '映射配置', tab: 'mapping', required: false }
  ];

  // 自动保存功能
  useEffect(() => {
    const subscription = form.watch((value) => {
      if (isAutoSaving) return;

      const timeoutId = setTimeout(async () => {
        setIsAutoSaving(true);
        try {
          // 保存草稿到localStorage
          localStorage.setItem('adsPowerConfigDraft', JSON.stringify(value));
        } catch (error) {
          logger.warn('自动保存失败:');
        } finally {
          setIsAutoSaving(false);
        }
      }, 2000); // 2秒后自动保存

      return () => clearTimeout(timeoutId);
    });

    return () => subscription.unsubscribe();
  }, [form.watch, isAutoSaving]);
  // 步骤验证
  const validateStep = useCallback((stepId: number): boolean => {
    const values = form.getValues();

    switch (stepId) {
      case 1: // 基础配置
        return !!(values.name && values.environmentId && values.notificationEmail);
      case 2: // 链接配置
        return !!(values.originalLinks && values.originalLinks.length > 0 &&
          values.originalLinks.every(link => link.trim().length > 0));
      case 3: // 映射配置
        return true; // 可选步骤
      default:
        return false;
    }
  }, [form]);
  // 步骤导航
  const goToStep = useCallback((stepId: number) => {
    const step = steps.find(s => s.id === stepId);
    if (step) {
      setActiveTab(step.tab);
      setCurrentStep(stepId);
    }
  }, [steps]);
  // 下一步
  const nextStep = useCallback(() => {
    if (validateStep(currentStep)) {
      setCompletedSteps(prev => new Set(Array.from(prev).concat([currentStep])));
      if (currentStep < steps.length) {
        goToStep(currentStep + 1);
      }
    }
  }, [currentStep, validateStep, goToStep, steps.length]);
  // 上一步
  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);
  // 原始链接字段数组
  const handleAddOriginalLink = () => {
    const currentLinks = form.getValues('originalLinks') || [];
    form.setValue('originalLinks', [...currentLinks, '']);
  };

  const handleRemoveOriginalLink = (index: number) => {
    const currentLinks = form.getValues('originalLinks') || [];
    form.setValue('originalLinks', currentLinks.filter((_, i) => i !== index));
  };

  // 链接映射字段数组
  const {
    fields: linkMappingFields,
    append: appendLinkMapping,
    remove: removeLinkMapping,
    update: updateLinkMapping
  } = useFieldArray({
    control: form.control,
    name: 'linkMappings' as const
  });
  // 获取所有可用的广告
  const getAllAds = () => {
    const ads: { id: string; name: string; accountName: string; campaignName: string; adGroupName: string }[] = [];

    googleAdsAccounts.forEach(account => {
      account.campaignMappings?.forEach(campaign => {
        campaign.adGroupMappings?.forEach(adGroup => {
          adGroup.adMappings?.forEach(ad => {
            if (ad.adId && ad.adName && campaign.campaignName && adGroup.adGroupName) {
              ads.push({
                id: ad.adId,
                name: ad.adName,
                accountName: account.accountName,
                campaignName: campaign.campaignName,
                adGroupName: adGroup.adGroupName
              });
            }
          });
        });
      });
    });

    return ads;
  };

  // 验证环境ID
  const handleValidateEnvironment = async (environmentId: string) => {
    if (!environmentId) {
      setEnvironmentValidation({ status: 'idle' });
      return;
    }

    setEnvironmentValidation({ status: 'validating' });
    try {
      const isValid = await onValidateEnvironment(environmentId);
      setEnvironmentValidation({
        status: isValid ? 'valid' : 'invalid',
        message: isValid ? '环境ID验证成功' : '环境ID无效或无法连接'
      });
    } catch (error) {
      setEnvironmentValidation({
        status: 'invalid',
        message: '验证失败: ' + (error instanceof Error ? error.message : '未知错误')
      });
    }
  };

  // 测试链接
  const handleTestLinks = async () => {
    const links = (form.getValues('originalLinks') || []).filter(link => link.trim() !== '');
    if (links.length === 0) return;

    setLinkValidation({ status: 'validating' });
    try {
      const results = await onTestLinks(links);
      setLinkValidation({
        status: results.every(r => r.valid) ? 'valid' : 'invalid',
        results
      });
    } catch (error) {
      setLinkValidation({
        status: 'invalid',
        results: links?.filter(Boolean)?.map(url => ({
          url,
          valid: false,
          error: error instanceof Error ? error.message : '测试失败'
        }))
      });
    }
  };

  
  // 自动生成链接映射
  const handleGenerateLinkMappings = () => {
    const links = (form.getValues('originalLinks') || []).filter(link => link.trim() !== '');
    const ads = getAllAds();

    if (links.length === 0 || ads.length === 0) return;

    const newMappings = links.map((url, index) => ({
      originalUrl: url,
      targetAdIds: [ads[index % ads.length].id], // 循环分配广告
      priority: index + 1,
      enabled: true
    }));

    form.setValue('linkMappings', newMappings);
  };

  // 表单提交
  const handleSubmit = (values: Partial<AdsPowerConfigFormValues>) => {
    onSubmit(values as AdsPowerConfigFormValues);
  };

  // 预览配置
  const handlePreview = () => {
    const values = form.getValues();
    onPreview(values as AdsPowerConfigFormValues);
    setShowPreview(true);
  };

  // 监听环境ID变化
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'environmentId' && value.environmentId) {
        const timeoutId = setTimeout(() => {
          handleValidateEnvironment(value.environmentId!);
        }, 500); // 防抖

        return () => clearTimeout(timeoutId);
      }
      return undefined;
    });

    return () => subscription.unsubscribe();
  }, [form.watch, handleValidateEnvironment]);
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* 步骤指示器 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium cursor-pointer transition-colors ${currentStep === step.id
                    ? 'bg-blue-600 text-white'
                    : completedSteps.has(step.id)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  onClick={() => goToStep(step.id)}
                >
                  {completedSteps.has(step.id) ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    step.id
                  )}
                </div>
                <span className={`ml-2 text-sm ${currentStep === step.id ? 'text-blue-600 font-medium' : 'text-gray-600'
                  }`}>
                  {step.title}
                </span>
                {index < steps.length - 1 && (
                  <div className="w-8 h-px bg-gray-300 mx-4" />
                )}
              </div>
            ))}
          </div>

          {/* 自动保存指示器 */}
          {isAutoSaving && (
            <div className="flex items-center text-sm text-gray-500">
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              自动保存中...
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          const step = steps.find(s => s.tab === value);
          if (step) setCurrentStep(step.id);
        }}>
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="basic" className="flex items-center gap-2">
              {completedSteps.has(1) && <CheckCircle className="h-4 w-4 text-green-600" />}
              基础配置
            </TabsTrigger>
            <TabsTrigger value="links" className="flex items-center gap-2">
              {completedSteps.has(2) && <CheckCircle className="h-4 w-4 text-green-600" />}
              链接配置
            </TabsTrigger>
            <TabsTrigger value="mapping" className="flex items-center gap-2">
              {completedSteps.has(3) && <CheckCircle className="h-4 w-4 text-green-600" />}
              映射配置
            </TabsTrigger>
          </TabsList>

          {/* 基础配置 */}
          <TabsContent value="basic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  基础信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>配置名称 *</FormLabel>
                        <FormControl>
                          <Input placeholder="输入配置名称" {...field} />
                        </FormControl>
                        <FormDescription>为您的配置起一个易于识别的名称</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notificationEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>通知邮箱 *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="输入通知邮箱" {...field} />
                        </FormControl>
                        <FormDescription>执行结果将发送到此邮箱</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>配置描述</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="输入配置描述（可选）"
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>描述此配置的用途和特点</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  AdsPower配置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="environmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>AdsPower环境ID *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input placeholder="输入AdsPower环境ID" {...field} />
                            {environmentValidation.status === 'validating' && (
                              <RefreshCw className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
                            )}
                            {environmentValidation.status === 'valid' && (
                              <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                            )}
                            {environmentValidation.status === 'invalid' && (
                              <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </FormControl>
                        <FormDescription>用于执行链接跟踪的AdsPower环境ID</FormDescription>
                        {environmentValidation.message && (
                          <div className={`text-sm ${environmentValidation.status === 'valid' ? 'text-green-600' : 'text-red-600'}`}>
                            {environmentValidation.message}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="repeatCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>重复执行次数 *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            placeholder="输入重复次数"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormDescription>每个链接将被执行的次数（1-10次）</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {environmentValidation.status === 'valid' && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      AdsPower环境连接正常，可以进行链接跟踪操作。
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 链接配置 */}
          <TabsContent value="links" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Link className="h-5 w-5" />
                  原始链接配置
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestLinks}
                    disabled={linkValidation.status === 'validating'}
                  >
                    {linkValidation.status === 'validating' ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    测试链接
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddOriginalLink}>
                    <Plus className="h-4 w-4 mr-2" />
                    添加链接
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {(form.getValues('originalLinks') || []).map((_, index) => (
                  <div key={`original-link-${index}`} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <FormField
                          control={form.control}
                          name={`originalLinks.${index}`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  placeholder="输入原始链接URL"
                                  {...field}
                                  className="font-mono text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      {(form.getValues('originalLinks') || []).length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveOriginalLink(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>

                    {/* 显示链接验证结果 */}
                    {linkValidation.results && linkValidation.results[index] && (
                      <div className={`text-xs p-2 rounded ${linkValidation.results[index].valid
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                        {linkValidation.results[index].valid ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            链接有效
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {linkValidation.results[index].error || '链接无效'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* 链接验证总结 */}
                {linkValidation.results && (
                  <Alert className={linkValidation.status === 'valid' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                    {linkValidation.status === 'valid' ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <AlertDescription className={linkValidation.status === 'valid' ? 'text-green-700' : 'text-red-700'}>
                      {linkValidation.status === 'valid'
                        ? `所有 ${linkValidation.results.length} 个链接验证通过`
                        : `${linkValidation.results.filter(r => !r.valid).length} 个链接验证失败`
                      }
                    </AlertDescription>
                  </Alert>
                )}

                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                  <p className="font-medium mb-1">链接配置说明：</p>
                  <ul className="text-xs space-y-1 list-disc list-inside">
                    <li>每个原始链接将被重复执行指定次数</li>
                    <li>系统会自动提取最终跳转URL和参数</li>
                    <li>建议先测试链接确保可以正常访问</li>
                    <li>支持各种推广链接和跳转链接</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 映射配置 */}
          <TabsContent value="mapping" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>链接与广告映射配置</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateLinkMappings}
                  disabled={getAllAds().length === 0}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  自动生成映射
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {getAllAds().length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      请先在Google Ads账户配置中添加广告信息，然后才能配置链接映射。
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                      <p className="font-medium mb-1">映射配置说明：</p>
                      <ul className="text-xs space-y-1 list-disc list-inside">
                        <li>每个原始链接可以映射到一个或多个Google Ads广告</li>
                        <li>执行时会按照重复次数提取多个最终URL</li>
                        <li>系统会按照执行顺序将结果分配给对应的广告</li>
                        <li>优先级决定了链接的处理顺序</li>
                      </ul>
                    </div>

                    {linkMappingFields.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>暂无链接映射配置</p>
                        <p className="text-sm">点击"自动生成映射"或手动添加映射关系</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {linkMappingFields.map((field, index) => (
                          <Card key={field.id} className="border-dashed">
                            <CardHeader className="pb-2">
                              <div className="flex justify-between items-center">
                                <h4 className="text-sm font-medium">映射 {index + 1}</h4>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeLinkMapping(index)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <FormField
                                control={form.control}
                                name={`linkMappings.${index}.originalUrl`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>原始链接</FormLabel>
                                    <FormControl>
                                      <Input {...field} className="font-mono text-sm" readOnly />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />

                              <div className="grid grid-cols-2 gap-3">
                                <FormField
                                  control={form.control}
                                  name={`linkMappings.${index}.priority`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>优先级</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          min={1}
                                          max={10}
                                          {...field}
                                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`linkMappings.${index}.enabled`}
                                  render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2 pt-6">
                                      <FormControl>
                                        <input
                                          type="checkbox"
                                          checked={field.value}
                                          onChange={field.onChange}
                                          className="rounded"
                                        />
                                      </FormControl>
                                      <FormLabel className="text-sm">启用此映射</FormLabel>
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div>
                                <FormLabel>目标广告</FormLabel>
                                <div className="mt-2 space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                                  {getAllAds()?.filter(Boolean)?.map(ad => (
                                    <div key={ad.id} className="flex items-center space-x-2 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={form.watch(`linkMappings.${index}.targetAdIds`)?.includes(ad.id) || false}
                                        onChange={(e) => {
                                          const currentIds = form.getValues(`linkMappings.${index}.targetAdIds`) || [];
                                          if (e.target.checked) {
                                            form.setValue(`linkMappings.${index}.targetAdIds`, [...currentIds, ad.id]);
                                          } else {
                                            form.setValue(`linkMappings.${index}.targetAdIds`, currentIds.filter(id => id !== ad.id));
                                          }
                                        }}
                                        className="rounded"
                                      />
                                      <div className="flex-1">
                                        <p className="font-medium">{ad.name}</p>
                                        <p className="text-xs text-gray-500">
                                          {ad.accountName} → {ad.campaignName} → {ad.adGroupName}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 步骤导航按钮 */}
        <div className="flex justify-between items-center pt-6 border-t">
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={prevStep}>
                上一步
              </Button>
            )}
            <Button type="button" variant="outline" onClick={handlePreview}>
              <Eye className="h-4 w-4 mr-2" />
              预览配置
            </Button>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              <X className="h-4 w-4 mr-2" />
              取消
            </Button>

            {currentStep < steps.length ? (
              <Button
                type="button"
                onClick={nextStep}
                disabled={!validateStep(currentStep)}
              >
                下一步
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting || !validateStep(currentStep)}>
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    保存配置
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* 配置预览模态框 */}
        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">配置预览</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">基础信息</h4>
                    <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
                      <p><strong>配置名称:</strong> {form.getValues('name')}</p>
                      <p><strong>环境ID:</strong> {form.getValues('environmentId')}</p>
                      <p><strong>重复次数:</strong> {form.getValues('repeatCount')}</p>
                      <p><strong>通知邮箱:</strong> {form.getValues('notificationEmail')}</p>
                      {form.getValues('description') && (
                        <p><strong>描述:</strong> {form.getValues('description')}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">原始链接 ({(form.getValues('originalLinks') || []).filter(l => l.trim()).length}个)</h4>
                    <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
                      {(form.getValues('originalLinks') || []).filter(l => l.trim()).map((link, index) => (
                        <p key={index} className="font-mono break-all">{index + 1}. {link}</p>
                      ))}
                    </div>
                  </div>

                  {form.getValues('linkMappings') && (form.getValues('linkMappings') || []).length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">链接映射 ({(form.getValues('linkMappings') || []).length}个)</h4>
                      <div className="bg-gray-50 p-3 rounded text-sm space-y-2">
                        {(form.getValues('linkMappings') || []).map((mapping, index) => (
                          <div key={index} className="border-l-2 border-blue-500 pl-2">
                            <p className="font-mono text-xs break-all">{mapping.originalUrl}</p>
                            <p className="text-xs text-gray-600">
                              映射到 {mapping.targetAdIds.length} 个广告，优先级: {mapping.priority}
                              {!mapping.enabled && <Badge variant="secondary" className="ml-2">已禁用</Badge>}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    </Form>
  );
}