'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, Globe, GitBranch, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
import { detectEnvironment } from '@/lib/domain-config';

const logger = createClientLogger('DeploymentStatus');

// 部署状态横幅组件
export function DeploymentBanner() {
  const env = detectEnvironment();
  
  // 根据环境显示不同的横幅
  const shouldShowBanner = env === 'development' || env === 'preview';
  
  if (env === 'production') return null as any;

  const getBannerConfig = () => {
    if (env === 'preview') {
      return {
        color: 'bg-blue-50 border-blue-200',
        textColor: 'text-blue-800',
        badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
        iconColor: 'text-blue-600',
        title: 'Preview环境',
        subtitle: 'Vercel预览版本'
      };
    } else if (env === 'development') {
      return {
        color: 'bg-green-50 border-green-200',
        textColor: 'text-green-800',
        badgeColor: 'bg-green-100 text-green-800 border-green-300',
        iconColor: 'text-green-600',
        title: '开发环境',
        subtitle: '本地开发版本'
      };
    } else {
      return {
        color: 'bg-yellow-50 border-yellow-200',
        textColor: 'text-yellow-800',
        badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        iconColor: 'text-yellow-600',
        title: '测试环境',
        subtitle: '测试版本'
      };
    }
  };

  const config = getBannerConfig();

  return (
    <div className={`${config.color} border-b px-4 py-2`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className={`w-5 h-5 ${config.iconColor}`} />
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${config.textColor}`}>
              {config.title}
            </span>
            <Badge variant="outline" className={config.badgeColor}>
              {config.subtitle}
            </Badge>
          </div>
        </div>
        <div className={`flex items-center gap-2 text-xs ${config.textColor}`}>
          <Globe className="w-4 h-4" />
          <span>ClawCloud</span>
        </div>
      </div>
    </div>
  );
}

// 详细的部署信息组件
export function DeploymentInfo() {
  const env = detectEnvironment();
  const [healthStatus, setHealthStatus] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkHealth = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealthStatus(data);
    } catch (error) { 
      logger.error('Health check failed:', new EnhancedError('Health check failed:', { 
        error: error instanceof Error ? error.message : String(error) 
      }));
      setHealthStatus({ 
        status: 'error', 
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const isProduction = env === 'production';
  const isTesting = env === 'development' || env === 'preview';

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="w-5 h-5" />
          部署信息
          {healthStatus && (
            <Badge 
              variant={healthStatus.status === 'healthy' ? 'default' : 'destructive'}
              className="ml-auto"
            >
              {healthStatus.status === 'healthy' ? (
                <><CheckCircle className="w-3 h-3 mr-1" />健康</>
              ) : (
                <><AlertTriangle className="w-3 h-3 mr-1" />异常</>
              )}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600">环境</div>
            <div className="flex items-center gap-2">
              <Badge variant={isProduction ? 'default' : 'secondary'}>
                {isProduction ? '生产环境' : '测试环境'}
              </Badge>
              <Badge variant="outline">
                稳定版
              </Badge>
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600">区域</div>
            <div className="font-mono text-sm">ClawCloud</div>
          </div>
          
          <div>
            <div className="text-sm text-gray-600">构建时间</div>
            <div className="text-sm">
              {new Date().toLocaleString()}
            </div>
          </div>
        </div>

        {healthStatus && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">系统状态</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={checkHealth}
                disabled={isLoading}
              >
                {isLoading ? '检查中...' : '刷新'}
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span>运行时间:</span>
                <span>{Math.floor((healthStatus.uptime as number) || 0)}秒</span>
              </div>
              <div className="flex justify-between">
                <span>内存使用:</span>
                <span>
                  {healthStatus.memory && typeof healthStatus.memory === 'object' && 'heapUsed' in healthStatus.memory ? 
                    `${Math.round((healthStatus.memory as any).heapUsed / 1024 / 1024)}MB` : 
                    'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span>Node版本:</span>
                <span>{(healthStatus.nodeVersion as string) || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>环境:</span>
                <span>{(healthStatus.environment as string) || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {isTesting && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              <span>这是测试环境，功能可能不稳定</span>
            </div>
            {isProduction && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => window.open('https://www.autoads.dev', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                访问生产环境
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 版本对比组件
export function VersionComparison() {
  const versionFeatures = {
    stable: {
      name: '稳定版本',
      description: '经过充分测试的生产版本',
      features: [
        '网站排名分析',
        '批量链接处理',
        '链接批量打开',
        '基础性能优化'
      ],
      color: 'bg-green-100 text-green-800'
    },
    beta: {
      name: 'Beta测试版本',
      description: '包含最新功能的测试版本',
      features: [
        '网站排名分析',
        '批量链接处理',
        '链接批量打开',
        '基础性能优化',
        '新UI界面设计',
        'AI驱动的分析',
        '增强的用户体验',
        '性能监控面板'
      ],
      color: 'bg-blue-100 text-blue-800'
    }
  };

  const currentVersion = versionFeatures.stable;
  const otherVersion = versionFeatures.beta;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            当前版本
            <Badge className={currentVersion.color}>
              {currentVersion.name}
            </Badge>
          </CardTitle>
          <p className="text-sm text-gray-600">{currentVersion.description}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {currentVersion.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-gray-600" />
            其他版本
            <Badge variant="outline">
              {otherVersion.name}
            </Badge>
          </CardTitle>
          <p className="text-sm text-gray-600">{otherVersion.description}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {otherVersion.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div className={`w-4 h-4 rounded-full ${
                  currentVersion.features.includes(feature) 
                    ? 'bg-green-500' 
                    : 'bg-gray-300'
                }`} />
                <span className={
                  currentVersion.features.includes(feature) 
                    ? '' 
                    : 'text-gray-500'
                }>
                  {feature}
                </span>
                {!currentVersion.features.includes(feature) && (
                  <Badge variant="outline" className="text-xs">新功能</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}