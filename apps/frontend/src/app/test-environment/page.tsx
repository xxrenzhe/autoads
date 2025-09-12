'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { detectEnvironment, getDomainConfig, getGoogleOAuthConfig, isDomainAllowed } from '@/lib/domain-config';
import { EnhancedError } from '@/lib/utils/error-handling';

interface TestResult {
  name: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

export default function EnvironmentTestPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [envInfo, setEnvInfo] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const runTests = async () => {
    try {
      setIsTesting(true);
      const testResults: TestResult[] = [];

      // 1. Environment Detection
      const env = detectEnvironment();
      testResults.push({
        name: 'Environment Detection',
        status: 'success',
        message: `检测到: ${env}`,
        details: { environment: env }
      });

      // 2. Domain Configuration
      const config = getDomainConfig();
      testResults.push({
        name: 'Domain Configuration',
        status: 'success',
        message: `域名: ${config.domain}`,
        details: {
          domain: config.domain,
          baseUrl: config.baseUrl,
          isLocal: config.isLocal,
          isHttps: config.isHttps,
          apiBaseUrl: config.apiBaseUrl
        }
      });

      // 3. Domain Validation
      const domainAllowed = isDomainAllowed(config.domain);
      testResults.push({
        name: 'Domain Validation',
        status: domainAllowed ? 'success' : 'error',
        message: domainAllowed ? '域名在允许列表中' : '域名不在允许列表中',
        details: { domainAllowed, domain: config.domain }
      });

      // 4. OAuth Configuration
      const oauthConfig = getGoogleOAuthConfig();
      const hasClientId = !!oauthConfig.clientId;
      const hasDeveloperToken = !!oauthConfig.developerToken;
      
      testResults.push({
        name: 'OAuth Configuration',
        status: hasClientId && hasDeveloperToken ? 'success' : 'warning',
        message: hasClientId && hasDeveloperToken 
          ? 'OAuth 配置完整' 
          : '缺少 OAuth 凭据',
        details: {
          hasClientId,
          hasDeveloperToken,
          redirectUri: oauthConfig.redirectUri,
          scope: oauthConfig.scope
        }
      });

      // 5. HTTPS Check
      const httpsCorrect = config.isHttps || config.isLocal;
      testResults.push({
        name: 'HTTPS Configuration',
        status: httpsCorrect ? 'success' : 'error',
        message: httpsCorrect 
          ? config.isLocal ? '开发环境允许使用 HTTP' : 'HTTPS 已正确配置'
          : '需要 HTTPS 但未检测到',
        details: {
          isHttps: config.isHttps,
          isLocal: config.isLocal,
          enableHttps: config.enableHttps
        }
      });

      // 6. Security Headers Check
      const securityChecks = {
        secureCookies: config.secureCookies,
        enableHttps: config.enableHttps,
        allowedDomains: ['localhost:3000', 'autoads.dev']
      };
      
      testResults.push({
        name: 'Security Configuration',
        status: 'success',
        message: '安全设置已应用',
        details: securityChecks
      });

      // 7. Feature Flags
      const features = {
        analytics: config.enableAnalytics,
        errorReporting: config.enableErrorReporting,
        performanceMonitoring: config.enablePerformanceMonitoring,
        debugMode: config.debugMode
      };
      
      testResults.push({
        name: 'Feature Flags',
        status: 'success',
        message: '功能标志已配置',
        details: features
      });

      // Set environment info from current configuration
      const currentEnv = detectEnvironment();
      const currentConfig = getDomainConfig();
      setEnvInfo({
        environment: currentEnv,
        domain: currentConfig.domain,
        baseUrl: currentConfig.baseUrl,
        isLocal: currentConfig.isLocal,
        isHttps: currentConfig.isHttps,
        features: {
          analytics: currentConfig.enableAnalytics,
          errorReporting: currentConfig.enableErrorReporting,
          performanceMonitoring: currentConfig.enablePerformanceMonitoring,
          debugMode: currentConfig.debugMode
        },
        security: {
          httpsOnly: currentConfig.enableHttps && !currentConfig.isLocal
        }
      });
      setResults(testResults);

    } catch (error) {
      console.error('Error running tests:', error);
      const errorResult: TestResult = {
        name: 'Test Suite',
        status: 'error',
        message: error instanceof Error ? error.message : '发生未知错误',
        details: { error: error instanceof Error ? error.stack : 'Unknown error' }
      };
      setResults([errorResult]);
    } finally {
      setIsTesting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    if (!text) {
      console.warn('No text provided to copy');
      return;
    }

    setIsCopying(true);
    setCopyStatus('idle');

    try {
      // Check if navigator.clipboard is available
      if (!navigator.clipboard) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
          console.log('URL已复制到剪贴板 (fallback):', text);
          setCopyStatus('success');
          // Reset status after 2 seconds
          setTimeout(() => setCopyStatus('idle'), 2000);
        } catch (fallbackErr) {
          console.error('复制失败 (fallback):', fallbackErr);
          setCopyStatus('error');
          throw new Error('复制失败，请手动复制');
        } finally {
          document.body.removeChild(textArea);
        }
      } else {
        // Modern clipboard API
        await navigator.clipboard.writeText(text);
        console.log('URL已复制到剪贴板:', text);
        setCopyStatus('success');
        // Reset status after 2 seconds
        setTimeout(() => setCopyStatus('idle'), 2000);
      }
    } catch (err) {
      console.error('复制失败:', err);
      setCopyStatus('error');
      throw err;
    } finally {
      setIsCopying(false);
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">通过</Badge>;
      case 'error':
        return <Badge variant="destructive">失败</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">警告</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">环境配置测试</h1>
        <p className="text-gray-600">
          验证您的环境配置在开发、预览和生产环境中是否正常工作。
        </p>
      </div>

      {/* Environment Info */}
      {envInfo && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>当前环境</span>
              <Badge variant="outline">{envInfo.environment}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p><strong>域名:</strong> {envInfo.domain}</p>
                <p><strong>基础URL:</strong> {envInfo.baseUrl}</p>
                <p><strong>本地环境:</strong> {envInfo.isLocal ? '是' : '否'}</p>
                <p><strong>HTTPS:</strong> {envInfo.isHttps ? '是' : '否'}</p>
              </div>
              <div>
                <p><strong>分析功能:</strong> {envInfo.features.analytics ? '已启用' : '已禁用'}</p>
                <p><strong>错误报告:</strong> {envInfo.features.errorReporting ? '已启用' : '已禁用'}</p>
                <p><strong>调试模式:</strong> {envInfo.features.debugMode ? '已启用' : '已禁用'}</p>
                <p><strong>仅HTTPS:</strong> {envInfo.security.httpsOnly ? '已启用' : '已禁用'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Results */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">测试结果</h2>
          <Button onClick={runTests} disabled={isTesting} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? '正在运行测试...' : '重新运行测试'}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((result, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <h3 className="font-medium">{result.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{result.message}</p>
                      {result.details && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                            查看详情
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(result.status)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
          <CardDescription>
            环境管理的有用链接和工具
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await copyToClipboard(envInfo?.baseUrl || '');
                } catch (err) {
                  console.error('复制失败:', err);
                }
              }}
              disabled={isCopying || !envInfo?.baseUrl}
              className="justify-start"
            >
              {isCopying ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : copyStatus === 'success' ? (
                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
              ) : copyStatus === 'error' ? (
                <XCircle className="h-4 w-4 mr-2 text-red-600" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {isCopying ? '正在复制...' : copyStatus === 'success' ? '已复制!' : copyStatus === 'error' ? '复制失败' : '复制基础URL'}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('/api/health', '_blank')}
              className="justify-start"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              检查健康状态端点
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('https://console.cloud.google.com/', '_blank')}
              className="justify-start"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Google Cloud 控制台
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('https://vercel.com/dashboard', '_blank')}
              className="justify-start"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Vercel 仪表板
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Environment Documentation */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>环境文档</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>
              <strong>开发环境:</strong> 在 localhost:3000 上使用 HTTP，启用调试功能
            </p>
            <p>
              <strong>预览环境:</strong> 自动部署的 Vercel 预览版，使用 HTTPS 和调试模式
            </p>
            <p>
              <strong>生产环境:</strong> 在 autoads.dev 上仅使用 HTTPS，具备所有安全功能
            </p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}