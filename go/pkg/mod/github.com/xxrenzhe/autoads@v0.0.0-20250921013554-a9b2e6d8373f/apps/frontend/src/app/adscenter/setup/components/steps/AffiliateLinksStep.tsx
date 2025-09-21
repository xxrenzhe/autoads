'use client';

import React, { memo, useCallback } from 'react';
import { LinkIcon, TestTube } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AffiliateLink {
  id: string;
  name: string;
  affiliateUrl: string;
  description?: string;
  category?: string;
  isActive: boolean;
  status: 'valid' | 'invalid' | 'untested';
}

interface AffiliateLinksStepProps {
  links: AffiliateLink[];
  newLink: Partial<AffiliateLink>;
  loading: boolean;
  onLinkChange: (link: Partial<AffiliateLink>) => void;
  onAddLink: () => void;
  onTestLink: (linkId: string) => void;
}

export const AffiliateLinksStep = memo(({ 
  links, 
  newLink, 
  loading, 
  onLinkChange, 
  onAddLink, 
  onTestLink 
}: AffiliateLinksStepProps) => {
  const handleInputChange = useCallback((field: keyof AffiliateLink, value: string) => {
    onLinkChange({ ...newLink, [field]: value });
  }, [newLink, onLinkChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <LinkIcon className="h-5 w-5 mr-2" />
          广告联盟链接配置
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 现有链接列表 */}
        {links.length > 0 && (
          <div>
            <h4 className="font-medium mb-3">已配置的链接</h4>
            <div className="space-y-2">
              {links?.filter(Boolean)?.map((link: any) => (
                <div key={link.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{link.name}</div>
                    <div className="text-sm text-gray-600 truncate max-w-md">{link.affiliateUrl}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={link.status === 'valid' ? 'default' : 'secondary'}>
                      {link.status === 'valid' ? '有效' : link.status === 'invalid' ? '无效' : '未测试'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onTestLink(link.id)}
                      disabled={loading}
                    >
                      <TestTube className="h-4 w-4 mr-1" />
                      测试
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 添加新链接表单 */}
        <div>
          <h4 className="font-medium mb-3">添加新的广告联盟链接</h4>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">链接名称（Link Name）*<br/><span className="text-xs text-gray-500">自定义的广告联盟链接标识名称</span></label>
                <input
                  type="text"
                  value={newLink.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Home Depot 联盟链接"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">链接分类（Category）<br/><span className="text-xs text-gray-500">选择链接所属的业务类别</span></label>
                <select
                  value={newLink.category || ''}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">选择分类</option>
                  <option value="retail">零售电商</option>
                  <option value="travel">旅游出行</option>
                  <option value="finance">金融服务</option>
                  <option value="education">教育培训</option>
                  <option value="other">其他</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">联盟链接URL（Affiliate URL）*<br/><span className="text-xs text-gray-500">完整的广告联盟跳转链接地址</span></label>
              <input
                type="url"
                value={newLink.affiliateUrl || ''}
                onChange={(e) => handleInputChange('affiliateUrl', e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="https://yeahpromos.com/click?id=..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">链接描述（Description）<br/><span className="text-xs text-gray-500">链接的详细说明和使用场景</span></label>
              <textarea
                value={newLink.description || ''}
                onChange={(e: any) => handleInputChange('description', e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                rows={3}
                placeholder="链接描述和用途说明"
              />
            </div>
          </div>

          <div className="mt-4">
            <Button
              onClick={onAddLink}
              disabled={loading}
              className="flex items-center"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              {loading ? '添加中...' : '添加链接'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

AffiliateLinksStep.displayName = 'AffiliateLinksStep';
