/**
 * API版本控制系统
 * 提供向后兼容性保护和版本管理
 */

import { NextRequest, NextResponse } from 'next/server';

export interface ApiVersion {
  version: string;
  releaseDate: Date;
  deprecationDate?: Date;
  endOfLifeDate?: Date;
  isSupported: boolean;
  isDeprecated: boolean;
  features: string[];
  breakingChanges?: string[];
}

export interface VersionedResponse<T = any> {
  data: T;
  version: string;
  deprecationWarning?: string;
  migrationGuide?: string;
}

// 支持的API版本配置
export const API_VERSIONS: Record<string, ApiVersion> = {
  'v1': {
    version: 'v1',
    releaseDate: new Date('2024-01-01'),
    deprecationDate: new Date('2025-01-01'),
    endOfLifeDate: new Date('2025-06-01'),
    isSupported: true,
    isDeprecated: true,
    features: ['basic-auth', 'user-management', 'basic-analytics'],
    breakingChanges: [
      'Token字段从tokenBalance改为tokens',
      '用户状态从isActive改为status枚举'
    ]
  },
  'v2': {
    version: 'v2',
    releaseDate: new Date('2024-06-01'),
    deprecationDate: new Date('2025-06-01'),
    endOfLifeDate: new Date('2025-12-01'),
    isSupported: true,
    isDeprecated: false,
    features: [
      'enhanced-auth', 
      'user-management', 
      'advanced-analytics', 
      'token-management',
      'subscription-management'
    ]
  },
  'v3': {
    version: 'v3',
    releaseDate: new Date('2024-12-01'),
    isSupported: true,
    isDeprecated: false,
    features: [
      'oauth2', 
      'user-management', 
      'advanced-analytics', 
      'token-management',
      'subscription-management',
      'admin-panel',
      'real-time-sync',
      'enhanced-security'
    ]
  }
};

// 默认版本
export const DEFAULT_API_VERSION = 'v3';
export const MINIMUM_SUPPORTED_VERSION = 'v1';

/**
 * API版本管理器
 */
export class ApiVersionManager {
  /**
   * 从请求中提取API版本
   */
  static extractVersion(request: NextRequest): string {
    // 1. 从URL路径中提取版本 (e.g., /api/v2/users)
    const pathVersion = request.nextUrl.pathname.match(/\/api\/v(\d+)\//)?.[1];
    if (pathVersion) {
      return `v${pathVersion}`;
    }

    // 2. 从Accept头中提取版本 (e.g., application/vnd.api+json;version=2)
    const acceptHeader = request.headers.get('accept');
    if (acceptHeader) {
      const versionMatch = acceptHeader.match(/version=(\d+)/);
      if (versionMatch) {
        return `v${versionMatch[1]}`;
      }
    }

    // 3. 从自定义头中提取版本
    const versionHeader = request.headers.get('api-version') || 
                         request.headers.get('x-api-version');
    if (versionHeader) {
      return versionHeader.startsWith('v') ? versionHeader : `v${versionHeader}`;
    }

    // 4. 从查询参数中提取版本
    const versionParam = request.nextUrl.searchParams.get('version') ||
                        request.nextUrl.searchParams.get('api_version');
    if (versionParam) {
      return versionParam.startsWith('v') ? versionParam : `v${versionParam}`;
    }

    // 5. 返回默认版本
    return DEFAULT_API_VERSION;
  }

  /**
   * 验证版本是否支持
   */
  static isVersionSupported(version: string): boolean {
    const versionInfo = API_VERSIONS[version];
    return versionInfo?.isSupported ?? false;
  }

  /**
   * 检查版本是否已废弃
   */
  static isVersionDeprecated(version: string): boolean {
    const versionInfo = API_VERSIONS[version];
    return versionInfo?.isDeprecated ?? false;
  }

  /**
   * 获取版本信息
   */
  static getVersionInfo(version: string): ApiVersion | null {
    return API_VERSIONS[version] || null;
  }

  /**
   * 获取废弃警告信息
   */
  static getDeprecationWarning(version: string): string | null {
    const versionInfo = API_VERSIONS[version];
    if (!versionInfo?.isDeprecated) {
      return null as any;
    }

    const deprecationDate = versionInfo.deprecationDate?.toISOString().split('T')[0];
    const endOfLifeDate = versionInfo.endOfLifeDate?.toISOString().split('T')[0];

    let warning = `API版本 ${version} 已废弃`;
    if (deprecationDate) {
      warning += `（自 ${deprecationDate}）`;
    }
    if (endOfLifeDate) {
      warning += `，将于 ${endOfLifeDate} 停止支持`;
    }
    warning += `。请升级到最新版本 ${DEFAULT_API_VERSION}。`;

    return warning;
  }

  /**
   * 获取迁移指南URL
   */
  static getMigrationGuide(fromVersion: string, toVersion: string = DEFAULT_API_VERSION): string {
    return `/docs/migration/${fromVersion}-to-${toVersion}`;
  }

  /**
   * 创建版本化响应
   */
  static createVersionedResponse<T>(
    data: T,
    version: string,
    status: number = 200
  ): NextResponse<VersionedResponse<T>> {
    const response: VersionedResponse<T> = {
      data,
      version
    };

    // 添加废弃警告
    if (this.isVersionDeprecated(version)) {
      response.deprecationWarning = this.getDeprecationWarning(version) || undefined;
      response.migrationGuide = this.getMigrationGuide(version);
    }

    const nextResponse = NextResponse.json(response, { status });

    // 添加版本相关的响应头
    nextResponse.headers.set('API-Version', version);
    nextResponse.headers.set('Supported-Versions', Object.keys(API_VERSIONS).join(', '));
    
    if (this.isVersionDeprecated(version)) {
      nextResponse.headers.set('Deprecation', 'true');
      const versionInfo = API_VERSIONS[version];
      if (versionInfo?.endOfLifeDate) {
        nextResponse.headers.set('Sunset', versionInfo.endOfLifeDate.toISOString());
      }
    }

    return nextResponse;
  }

  /**
   * 数据转换器 - 将新版本数据转换为旧版本格式
   */
  static transformDataForVersion<T>(data: T, targetVersion: string): T {
    if (targetVersion === 'v1') {
      return this.transformToV1(data);
    } else if (targetVersion === 'v2') {
      return this.transformToV2(data);
    }
    return data; // v3或未知版本返回原始数据
  }

  /**
   * 转换数据到v1格式
   */
  private static transformToV1<T>(data: T): T {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const transformed = { ...data } as any;

    // 用户数据转换
    if ('tokenBalance' in transformed) {
      transformed.tokens = transformed.tokenBalance;
      delete transformed.tokenBalance;
    }

    if ('status' in transformed && transformed.status) {
      transformed.isActive = transformed.status === 'ACTIVE';
      delete transformed.status;
    }

    // 递归处理嵌套对象
    Object.keys(transformed).forEach((key: any) => {
      if (typeof transformed[key] === 'object' && transformed[key] !== null) {
        if (Array.isArray(transformed[key])) {
          transformed[key] = transformed[key].map((item: any: any) => this.transformToV1(item));
        } else {
          transformed[key] = this.transformToV1(transformed[key]);
        }
      }
    });

    return transformed;
  }

  /**
   * 转换数据到v2格式
   */
  private static transformToV2<T>(data: T): T {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const transformed = { ...data } as any;

    // v2特定的转换逻辑
    // 目前v2和v3兼容，无需特殊转换

    return transformed;
  }

  /**
   * 获取所有支持的版本
   */
  static getSupportedVersions(): string[] {
    return Object.keys(API_VERSIONS).filter((version: any) => 
      API_VERSIONS[version].isSupported
    );
  }

  /**
   * 获取最新版本
   */
  static getLatestVersion(): string {
    return DEFAULT_API_VERSION;
  }

  /**
   * 检查功能在指定版本中是否可用
   */
  static isFeatureAvailable(version: string, feature: string): boolean {
    const versionInfo = API_VERSIONS[version];
    return versionInfo?.features.includes(feature) ?? false;
  }
}

/**
 * API版本中间件
 */
export function withApiVersioning(handler: Function) {
  return async (request: NextRequest, ...args: any[]) => {
    const version = ApiVersionManager.extractVersion(request);

    // 检查版本是否支持
    if (!ApiVersionManager.isVersionSupported(version)) {
      return NextResponse.json(
        {
          error: 'Unsupported API version',
          message: `API版本 ${version} 不受支持`,
          supportedVersions: ApiVersionManager.getSupportedVersions(),
          latestVersion: ApiVersionManager.getLatestVersion()
        },
        { status: 400 }
      );
    }

    // 将版本信息添加到请求中
    (request as any).apiVersion = version;

    // 调用原始处理器
    const response = await handler(request, ...args);

    // 如果响应是NextResponse，添加版本头
    if (response instanceof NextResponse) {
      response.headers.set('API-Version', version);
      
      if (ApiVersionManager.isVersionDeprecated(version)) {
        response.headers.set('Deprecation', 'true');
        const warning = ApiVersionManager.getDeprecationWarning(version);
        if (warning) {
          response.headers.set('Warning', `299 - "${warning}"`);
        }
      }
    }

    return response;
  };
}

/**
 * 功能可用性检查装饰器
 */
export function requireFeature(feature: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (request: NextRequest, ...args: any[]) {
      const version = (request as any).apiVersion || ApiVersionManager.extractVersion(request);
      
      if (!ApiVersionManager.isFeatureAvailable(version, feature)) {
        return NextResponse.json(
          {
            error: 'Feature not available',
            message: `功能 ${feature} 在API版本 ${version} 中不可用`,
            availableInVersions: Object.keys(API_VERSIONS).filter((v: any) => 
              ApiVersionManager.isFeatureAvailable(v, feature)
            )
          },
          { status: 403 }
        );
      }

      return originalMethod.apply(this, [request, ...args]);
    };

    return descriptor;
  };
}