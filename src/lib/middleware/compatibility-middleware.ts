/**
 * 兼容性中间件
 * 处理API版本兼容性和废弃功能警告
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApiVersionManager } from '../api/version-control';
import { DeprecationWarningManager, DeprecatedFeature } from '../api/deprecation-warnings';

export interface CompatibilityOptions {
  enforceVersioning?: boolean;
  allowDeprecatedFeatures?: boolean;
  logDeprecationUsage?: boolean;
  transformResponse?: boolean;
}

/**
 * 兼容性中间件
 */
export function compatibilityMiddleware(options: CompatibilityOptions = {}) {
  const {
    enforceVersioning = true,
    allowDeprecatedFeatures = true,
    logDeprecationUsage = true,
    transformResponse = true
  } = options;

  return async function middleware(
    request: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    // 1. 提取API版本
    const apiVersion = ApiVersionManager.extractVersion(request);
    
    // 2. 验证版本支持
    if (enforceVersioning && !ApiVersionManager.isVersionSupported(apiVersion)) {
      return NextResponse.json(
        {
          error: 'Unsupported API Version',
          message: `API版本 ${apiVersion} 不受支持`,
          supportedVersions: ApiVersionManager.getSupportedVersions(),
          latestVersion: ApiVersionManager.getLatestVersion()
        },
        { status: 400 }
      );
    }

    // 3. 检查废弃版本
    const deprecatedFeatures: string[] = [];
    
    if (ApiVersionManager.isVersionDeprecated(apiVersion)) {
      deprecatedFeatures.push(`api-version-${apiVersion}`);
      
      if (logDeprecationUsage) {
        DeprecationWarningManager.logDeprecatedUsage(
          {
            name: `api-version-${apiVersion}`,
            deprecatedSince: 'v2.0',
            severity: 'medium',
            affectedEndpoints: [request.nextUrl.pathname],
            reason: 'API version is deprecated'
          },
          request,
          request.headers.get('user-agent') || undefined
        );
      }
    }

    // 4. 检查端点特定的废弃功能
    const endpoint = request.nextUrl.pathname;
    const method = request.method;
    
    // 检查已知的废弃端点
    const deprecatedEndpoints = getDeprecatedEndpoints(apiVersion);
    const matchedDeprecation = deprecatedEndpoints.find(dep => 
      endpoint.match(dep.pattern) && dep.methods.includes(method)
    );
    
    if (matchedDeprecation) {
      if (!allowDeprecatedFeatures) {
        return NextResponse.json(
          {
            error: 'Deprecated Feature',
            message: `端点 ${method} ${endpoint} 在版本 ${apiVersion} 中已废弃`,
            replacement: matchedDeprecation.replacement,
            migrationGuide: matchedDeprecation.migrationGuide
          },
          { status: 410 } // Gone
        );
      }
      
      deprecatedFeatures.push(matchedDeprecation.feature);
      
      if (logDeprecationUsage) {
        DeprecationWarningManager.logDeprecatedUsage(
          {
            name: matchedDeprecation.feature,
            deprecatedSince: 'v2.0',
            severity: 'medium',
            affectedEndpoints: [endpoint],
            reason: 'Endpoint is deprecated',
            replacement: matchedDeprecation.replacement,
            migrationGuide: matchedDeprecation.migrationGuide
          },
          request
        );
      }
    }

    // 5. 将版本信息添加到请求
    (request as any).apiVersion = apiVersion;
    (request as any).deprecatedFeatures = deprecatedFeatures;

    // 6. 调用处理器
    let response: NextResponse;
    try {
      response = await handler(request);
    } catch (error) {
      // 处理错误时也要添加版本信息
      const errorResponse = NextResponse.json(
        {
          error: 'Internal Server Error',
          message: '服务器内部错误',
          version: apiVersion
        },
        { status: 500 }
      );
      
      addCompatibilityHeaders(errorResponse, request, apiVersion, deprecatedFeatures);
      throw error;
    }

    // 7. 处理响应
    if (response instanceof NextResponse) {
      // 添加兼容性头
      addCompatibilityHeaders(response, request, apiVersion, deprecatedFeatures);
      
      // 转换响应数据格式（如果需要）
      if (transformResponse && response.headers.get('content-type')?.includes('application/json')) {
        try {
          const responseData = await response.json();
          const transformedData = ApiVersionManager.transformDataForVersion(responseData, apiVersion);
          
          // 创建新的响应
          const newResponse = NextResponse.json(transformedData, {
            status: response.status,
            statusText: response.statusText
          });
          
          // 复制原有头部
          response.headers.forEach((value, key) => {
            newResponse.headers.set(key, value);
          });
          
          // 重新添加兼容性头（可能被覆盖）
          addCompatibilityHeaders(newResponse, request, apiVersion, deprecatedFeatures);
          
          return newResponse;
        } catch (error) {
          // 如果JSON解析失败，返回原响应
          console.warn('响应数据转换失败:', error);
        }
      }
    }

    return response;
  };
}

/**
 * 添加兼容性相关的响应头
 */
function addCompatibilityHeaders(
  response: NextResponse,
  request: NextRequest,
  apiVersion: string,
  deprecatedFeatures: string[]
): void {
  // 添加版本信息
  response.headers.set('API-Version', apiVersion);
  response.headers.set('Supported-Versions', ApiVersionManager.getSupportedVersions().join(', '));
  response.headers.set('Latest-Version', ApiVersionManager.getLatestVersion());
  
  // 添加废弃警告
  if (deprecatedFeatures.length > 0) {
    response.headers.set('Deprecation', 'true');
    
    const warnings = deprecatedFeatures
      ?.filter(Boolean)?.map(featureName => {
        // Create a temporary DeprecatedFeature object for warning generation
        const feature: DeprecatedFeature = {
          name: featureName,
          deprecatedSince: 'v2.0',
          severity: 'medium',
          affectedEndpoints: [request.nextUrl.pathname],
          reason: 'Feature is deprecated'
        };
        return DeprecationWarningManager.generateWarningMessage(feature);
      })
      .filter(Boolean)
      ?.filter(Boolean)?.map(warning => `299 - "${warning}"`)
      .join(', ');
    
    if (warnings) {
      response.headers.set('Warning', warnings);
    }
    
    const migrationGuides = deprecatedFeatures
      ?.filter(Boolean)?.map(featureName => {
        // For now, return a generic migration guide
        return `/docs/migration/${featureName}`;
      })
      .filter(Boolean)
      .join(', ');
    
    if (migrationGuides) {
      response.headers.set('Migration-Guide', migrationGuides);
    }
  }
  
  // 添加版本废弃信息
  if (ApiVersionManager.isVersionDeprecated(apiVersion)) {
    const versionInfo = ApiVersionManager.getVersionInfo(apiVersion);
    if (versionInfo?.endOfLifeDate) {
      response.headers.set('Sunset', versionInfo.endOfLifeDate.toISOString());
    }
  }
}

/**
 * 获取废弃端点配置
 */
function getDeprecatedEndpoints(version: string): Array<{
  pattern: RegExp;
  methods: string[];
  feature: string;
  replacement?: string;
  migrationGuide?: string;
}> {
  const deprecatedEndpoints: Array<{
    pattern: RegExp;
    methods: string[];
    feature: string;
    replacement?: string;
    migrationGuide?: string;
  }> = [];

  if (version === 'v1') {
    deprecatedEndpoints.push(
      {
        pattern: /\/api\/v1\/auth\/login$/,
        methods: ['POST'],
        feature: 'legacy-auth',
        replacement: '/api/v2/auth/oauth',
        migrationGuide: '/docs/migration/legacy-auth-to-oauth2'
      },
      {
        pattern: /\/api\/v1\/users\/\w+\/tokens$/,
        methods: ['GET', 'PUT'],
        feature: 'token-field',
        replacement: '/api/v2/users/{id}/token-balance',
        migrationGuide: '/docs/migration/token-field-changes'
      }
    );
  }

  if (version === 'v2') {
    deprecatedEndpoints.push(
      {
        pattern: /\/api\/v2\/analytics\/basic$/,
        methods: ['GET'],
        feature: 'basic-analytics',
        replacement: '/api/v3/analytics/advanced',
        migrationGuide: '/docs/migration/analytics-upgrade'
      }
    );
  }

  return deprecatedEndpoints;
}

/**
 * 兼容性检查装饰器
 */
export function withCompatibility(options: CompatibilityOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const middleware = compatibilityMiddleware(options);

    descriptor.value = async function (request: NextRequest, ...args: any[]) {
      return middleware(request, async (req) => {
        return originalMethod.apply(this, [req, ...args]);
      });
    };

    return descriptor;
  };
}

/**
 * 版本特定的路由处理器
 */
export function createVersionedHandler(handlers: Record<string, Function>) {
  return async function (request: NextRequest, ...args: any[]) {
    const apiVersion = ApiVersionManager.extractVersion(request);
    
    // 查找版本特定的处理器
    let handler = handlers[apiVersion];
    
    // 如果没有找到，尝试使用最新版本的处理器
    if (!handler) {
      const latestVersion = ApiVersionManager.getLatestVersion();
      handler = handlers[latestVersion];
    }
    
    // 如果还是没有找到，使用默认处理器
    if (!handler) {
      handler = handlers['default'];
    }
    
    if (!handler) {
      return NextResponse.json(
        {
          error: 'No Handler Available',
          message: `没有可用的处理器处理版本 ${apiVersion}`,
          supportedVersions: Object.keys(handlers).filter(v => v !== 'default')
        },
        { status: 501 }
      );
    }
    
    // 应用兼容性中间件
    const middleware = compatibilityMiddleware();
    return middleware(request, handler as (req: NextRequest) => Promise<NextResponse>);
  };
}

/**
 * 创建兼容性响应
 */
export function createCompatibilityResponse<T>(
  data: T,
  request: NextRequest,
  status: number = 200
): NextResponse {
  const apiVersion = (request as any).apiVersion || ApiVersionManager.extractVersion(request);
  const deprecatedFeatures = (request as any).deprecatedFeatures || [];
  
  // 转换数据格式
  const transformedData = ApiVersionManager.transformDataForVersion(data, apiVersion);
  
  // 创建版本化响应
  const response = ApiVersionManager.createVersionedResponse(transformedData, apiVersion, status);
  
  // 添加废弃警告
  if (deprecatedFeatures.length > 0) {
    DeprecationWarningManager.addWarningHeaders(response, deprecatedFeatures);
  }
  
  return response;
}