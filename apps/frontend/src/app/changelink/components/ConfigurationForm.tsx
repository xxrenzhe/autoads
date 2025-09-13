'use client';

import React, { useState } from 'react';
import { EnhancedError } from '@/lib/utils/error-handling';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { TrackingConfiguration } from '../types';
const logger = createClientLogger('ConfigurationForm');

import { 
  Settings, 
  Link, 
  Clock, 
  Save, 
  X, 
  Plus, 
  Trash2,
  AlertCircle
} from 'lucide-react';

interface ConfigurationFormProps {
  onSave: (config: unknown) => void;
  onCancel: () => void;
  initialData?: Partial<TrackingConfiguration>;
}

export function ConfigurationForm({ onSave, onCancel, initialData }: ConfigurationFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    environmentId: initialData?.environmentId || '',
    repeatCount: initialData?.repeatCount || 1,
    originalLinks: initialData?.originalLinks || [''],
    schedulingEnabled: initialData?.schedulingConfig?.enabled || false,
    scheduleType: (initialData?.schedulingConfig?.frequency as 'daily' | 'weekly' | 'monthly' | 'custom' | 'once') || 'daily',
    scheduleHour: parseInt(initialData?.schedulingConfig?.time?.split(':')[0] || '9'),
    scheduleMinute: parseInt(initialData?.schedulingConfig?.time?.split(':')[1] || '0'),
    scheduleDayOfWeek: initialData?.schedulingConfig?.schedule?.days?.[0] || 1
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '配置名称不能为空';
    }

    if (!formData.environmentId.trim()) {
      newErrors.environmentId = '环境ID不能为空';
    }

    if (formData.repeatCount < 1) {
      newErrors.repeatCount = '重复次数必须大于0';
    }

    
    const validLinks = formData.originalLinks.filter((link: any) => link.trim());
    if (validLinks.length === 0) {
      newErrors.originalLinks = '至少需要添加一个原始链接';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const configData = {
        ...formData,
        originalLinks: formData.originalLinks.filter((link: any) => link.trim()),
        id: initialData?.id || `config_${Date.now()}`,
        status: 'active',
        createdAt: initialData?.createdAt || new Date(),
        updatedAt: new Date()
      };

      await onSave(configData);
    } catch (error) { 
      logger.error('保存配置失败:', new EnhancedError('保存配置失败:', { error: error instanceof Error ? error.message : String(error)  }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const addLink = () => {
    setFormData(prev => ({
      ...prev,
      originalLinks: [...prev.originalLinks, '']
    }));
  };

  const removeLink = (index: number) => {
    if (formData.originalLinks.length > 1) {
      setFormData(prev => ({
        ...prev,
        originalLinks: prev.originalLinks.filter((_, i: any) => i !== index)
      }));
    }
  };

  const updateLink = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      originalLinks: prev.originalLinks.map((link, i: any) => i === index ? value : link)
    }));
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold">
                {initialData ? '编辑配置' : '新建配置'}
              </CardTitle>
              <CardDescription>
                {initialData ? '修改现有配置参数' : '创建新的Google Ads自动化配置'}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              取消
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基本信息 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-blue-600" />
                基本信息
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">配置名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={((e: any) => setFormData(prev: any) => ({ ...prev, name: e.target.value }))}
                    placeholder="输入配置名称"
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.name}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="environmentId">AdsPower环境ID *</Label>
                  <Input
                    id="environmentId"
                    value={formData.environmentId}
                    onChange={((e: any) => setFormData(prev: any) => ({ ...prev, environmentId: e.target.value }))}
                    placeholder="输入环境ID"
                    className={errors.environmentId ? 'border-red-500' : ''}
                  />
                  {errors.environmentId && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.environmentId}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="repeatCount">重复次数 *</Label>
                  <Input
                    id="repeatCount"
                    type="number"
                    min="1"
                    max="100"
                    value={formData.repeatCount}
                    onChange={((e: any) => setFormData(prev: any) => ({ ...prev, repeatCount: parseInt(e.target.value) || 1 }))}
                    className={errors.repeatCount ? 'border-red-500' : ''}
                  />
                  {errors.repeatCount && (
                    <p className="text-sm text-red-500 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {errors.repeatCount}
                    </p>
                  )}
                </div>

                              </div>
            </div>

            {/* 原始链接 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Link className="w-5 h-5 mr-2 text-green-600" />
                原始链接
              </h3>
              
              <div className="space-y-3">
                {formData.originalLinks.map((link, index: any) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      value={link}
                      onChange={((e: any): any) => updateLink(index, e.target.value)}
                      placeholder={`原始链接 ${index + 1}`}
                      className="flex-1"
                    />
                    {formData.originalLinks.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={((: any): any) => removeLink(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={addLink}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  添加链接
                </Button>
              </div>
              
              {errors.originalLinks && (
                <p className="text-sm text-red-500 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.originalLinks}
                </p>
              )}
            </div>

            {/* 定时设置 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-purple-600" />
                定时设置
              </h3>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-base font-medium">启用定时执行</Label>
                  <p className="text-sm text-gray-500">设置自动执行时间</p>
                </div>
                <Switch
                  checked={formData.schedulingEnabled}
                  onCheckedChange={((checked: boolean: any) => setFormData(prev: any) => ({ ...prev, schedulingEnabled: checked }))}
                />
              </div>

              {formData.schedulingEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg">
                  <div className="space-y-2">
                    <Label>执行频率</Label>
                    <Select
                      value={formData.scheduleType}
                      onValueChange={((value: any) => setFormData(prev: any) => ({ ...prev, scheduleType: value as 'daily' | 'weekly' | 'monthly' | 'custom' | 'once' }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">每日</SelectItem>
                        <SelectItem value="weekly">每周</SelectItem>
                        <SelectItem value="custom">自定义</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>执行时间</Label>
                    <div className="flex space-x-2">
                      <Select
                        value={formData.scheduleHour.toString()}
                        onValueChange={((value: any) => setFormData(prev: any) => ({ ...prev, scheduleHour: parseInt(value) }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i.toString().padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="flex items-center">:</span>
                      <Select
                        value={formData.scheduleMinute.toString()}
                        onValueChange={((value: any) => setFormData(prev: any) => ({ ...prev, scheduleMinute: parseInt(value) }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 60 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i.toString().padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {formData.scheduleType === 'weekly' && (
                    <div className="space-y-2">
                      <Label>星期</Label>
                      <Select
                        value={formData.scheduleDayOfWeek.toString()}
                        onValueChange={((value: any) => setFormData(prev: any) => ({ ...prev, scheduleDayOfWeek: parseInt(value) }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">星期日</SelectItem>
                          <SelectItem value="1">星期一</SelectItem>
                          <SelectItem value="2">星期二</SelectItem>
                          <SelectItem value="3">星期三</SelectItem>
                          <SelectItem value="4">星期四</SelectItem>
                          <SelectItem value="5">星期五</SelectItem>
                          <SelectItem value="6">星期六</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t">
              <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    保存配置
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 