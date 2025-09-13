'use client';

import { SimpleVersionTest, VersionInfo } from './ABTestWrapper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// 示例：首页横幅的版本测试
export function HomePageBanner() {
  const handleCTAClick = () => {
    // A/B testing removed - tracking disabled
  };

  return (
    <SimpleVersionTest
      testName="homepage_banner"
      stableVersion={
        <div className="bg-blue-600 text-white p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-2">URL检测工具</h2>
          <p className="mb-4">快速检测网站状态和性能</p>
          <Button onClick={handleCTAClick} variant="secondary">
            开始检测
          </Button>
        </div>
      }
      betaVersion={
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8 rounded-xl shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-3xl font-bold">URL检测工具</h2>
            <Badge className="bg-yellow-400 text-black">NEW</Badge>
          </div>
          <p className="text-lg mb-6">AI驱动的智能网站分析和性能优化建议</p>
          <div className="flex gap-3">
            <Button onClick={handleCTAClick} variant="secondary" size="lg">
              免费开始检测
            </Button>
            <Button variant="outline" size="lg" className="text-white border-white hover:bg-white hover:text-blue-600">
              查看功能
            </Button>
          </div>
        </div>
      }
    />
  );
}

// 示例：功能卡片的版本测试
export function FeatureCards() {
  const handleFeatureClick = (feature: string) => {
    // A/B testing removed - tracking disabled
  };

  return (
    <SimpleVersionTest
      testName="feature_cards"
      stableVersion={
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>网站排名</CardTitle>
            </CardHeader>
            <CardContent>
              <p>分析网站在搜索引擎中的排名表现</p>
              <Button 
                className="mt-4" 
                onClick={((: any): any) => handleFeatureClick('siterank')}
              >
                使用工具
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>链接处理</CardTitle>
            </CardHeader>
            <CardContent>
              <p>批量处理和优化网站链接</p>
              <Button 
                className="mt-4" 
                onClick={((: any): any) => handleFeatureClick('adscenter')}
              >
                使用工具
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>批量打开</CardTitle>
            </CardHeader>
            <CardContent>
              <p>一键批量打开多个网页链接</p>
              <Button 
                className="mt-4" 
                onClick={((: any): any) => handleFeatureClick('batch-open')}
              >
                使用工具
              </Button>
            </CardContent>
          </Card>
        </div>
      }
      betaVersion={
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  🔍 网站排名
                  <Badge variant="outline">AI增强</Badge>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-3">AI驱动的智能网站排名分析，提供详细的SEO建议</p>
              <div className="flex gap-2">
                <Button 
                  onClick={((: any): any) => handleFeatureClick('siterank')}
                  className="flex-1"
                >
                  立即分析
                </Button>
                <Button variant="outline" size="sm">
                  演示
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔗 智能链接处理
                <Badge variant="outline">升级</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-3">自动化链接优化和批量处理，支持多种格式</p>
              <div className="flex gap-2">
                <Button 
                  onClick={((: any): any) => handleFeatureClick('adscenter')}
                  className="flex-1"
                >
                  开始处理
                </Button>
                <Button variant="outline" size="sm">
                  教程
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-purple-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                ⚡ 批量打开
                <Badge className="bg-yellow-100 text-yellow-800">热门</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-3">高效批量打开链接，支持自定义延迟和分组</p>
              <div className="flex gap-2">
                <Button 
                  onClick={((: any): any) => handleFeatureClick('batch-open')}
                  className="flex-1"
                >
                  批量打开
                </Button>
                <Button variant="outline" size="sm">
                  设置
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    />
  );
}

// 版本测试状态组件
export function VersionTestStatus() {
  // A/B testing removed - no version info available
  return null as any;
}

// 导出版本信息组件（用于生产环境）
export { VersionInfo };