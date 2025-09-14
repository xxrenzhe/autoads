/**
 * 交互式API文档页面
 * 使用Swagger UI展示API文档并提供测试功能
 */

'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// 动态导入Swagger UI以避免SSR问题
const SwaggerUI: any = dynamic(() => import('swagger-ui-react'), { ssr: false });

interface ApiVersion {
  version: string;
  name: string;
  description: string;
  specUrl: string;
}

const API_VERSIONS: ApiVersion[] = [
  {
    version: 'v3',
    name: 'API v3.0 (当前版本)',
    description: '最新版本，包含所有功能',
    specUrl: '/api/docs/openapi.yaml'
  },
  {
    version: 'v2',
    name: 'API v2.0 (已废弃)',
    description: '旧版本，建议升级到v3',
    specUrl: '/api/docs/v2/openapi.yaml'
  },
  {
    version: 'v1',
    name: 'API v1.0 (已废弃)',
    description: '最初版本，即将停止支持',
    specUrl: '/api/docs/v1/openapi.yaml'
  }
];

export default function ApiDocsPage() {
  const [selectedVersion, setSelectedVersion] = useState<ApiVersion>(API_VERSIONS[0]);
  const [authToken, setAuthToken] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // 从localStorage获取保存的token
    const savedToken = localStorage.getItem('api-docs-token');
    if (savedToken) {
      setAuthToken(savedToken);
    }
  }, []);

  const handleTokenChange = (token: string) => {
    setAuthToken(token);
    localStorage.setItem('api-docs-token', token);
  };

  const swaggerConfig = {
    url: selectedVersion.specUrl,
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      // SwaggerUIBundle.presets.apis,
      // SwaggerUIStandalonePreset
    ],
    plugins: [
      // SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: 'StandaloneLayout',
    requestInterceptor: (request: any) => {
      if (authToken) {
        request.headers.Authorization = `Bearer ${authToken}`;
      }
      return request;
    },
    onComplete: () => {
      console.log('Swagger UI loaded');
    }
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载API文档中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部导航 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">API 文档</h1>
              <p className="text-gray-600">AdsCenter AutoAds 管理系统 API</p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* 版本选择器 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API 版本
                </label>
                <select
                  value={selectedVersion.version}
                  onChange={(e) => {
                    const version = API_VERSIONS.find((v) => v.version === (e.target as HTMLSelectElement).value);
                    if (version) setSelectedVersion(version);
                  }}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {API_VERSIONS.map((version) => (
                    <option key={version.version} value={version.version}>
                      {version.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Token输入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  认证 Token
                </label>
                <input
                  type="password"
                  value={authToken}
                  onChange={(e) => handleTokenChange((e.target as HTMLInputElement).value)}
                  placeholder="输入您的API Token"
                  className="block w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 版本信息 */}
      <div className="bg-blue-50 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center">
            <div className="flex-1">
              <h2 className="text-lg font-medium text-blue-900">
                {selectedVersion.name}
              </h2>
              <p className="text-blue-700">{selectedVersion.description}</p>
            </div>
            
            {selectedVersion.version !== 'v3' && (
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-3 py-1 rounded-md text-sm">
                ⚠️ 此版本已废弃
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 快速开始指南 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">1. 获取 Token</h3>
              <p className="text-sm text-gray-600">
                使用 <code className="bg-gray-200 px-1 rounded">/auth/login</code> 端点登录获取认证令牌
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">2. 设置认证</h3>
              <p className="text-sm text-gray-600">
                在上方输入框中输入您的 Token，或在请求头中添加 
                <code className="bg-gray-200 px-1 rounded">Authorization: Bearer TOKEN</code>
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">3. 测试 API</h3>
              <p className="text-sm text-gray-600">
                使用下方的交互式文档测试各个 API 端点，查看请求和响应示例
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <a
                href="/docs/api/examples"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                📖 使用示例
              </a>
              <a
                href="/docs/api/changelog"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                📝 变更日志
              </a>
              <a
                href="/docs/api/sdk"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                🛠️ SDK 下载
              </a>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">环境:</span>
              <select className="text-sm border border-gray-300 rounded px-2 py-1">
                <option value="production">生产环境</option>
                <option value="staging">测试环境</option>
                <option value="development">开发环境</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Swagger UI */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto">
          <SwaggerUI {...(swaggerConfig as any)} />
        </div>
      </div>

      {/* 页脚 */}
      <div className="bg-gray-50 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              © 2024 AdsCenter AutoAds. 保留所有权利。
            </div>
            
            <div className="flex items-center space-x-4 text-sm">
              <a href="/support" className="text-gray-600 hover:text-gray-900">
                技术支持
              </a>
              <a href="/docs" className="text-gray-600 hover:text-gray-900">
                完整文档
              </a>
              <a href="https://github.com/autoads/api" className="text-gray-600 hover:text-gray-900">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
