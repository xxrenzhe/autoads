'use client';

import { ReactNode } from 'react';

interface VersionTestWrapperProps {
  children: ReactNode;
  versions: Record<string, ReactNode>;
  testName?: string;
  fallbackVersion?: string;
}

export function VersionTestWrapper({ 
  children, 
  versions, 
  fallbackVersion = 'stable'
}: VersionTestWrapperProps) {
  // A/B testing removed - always show stable version
  const version = 'stable';
  
  // 根据版本显示不同内容
  const versionContent = versions[version];
  if (versionContent) {
    return <>{versionContent}</>;
  }
  
  // 如果指定版本没有对应内容，尝试使用fallback版本
  const fallbackContent = versions[fallbackVersion];
  if (fallbackContent) {
    return <>{fallbackContent}</>;
  }
  
  // 兜底显示默认内容
  return <>{children}</>;
}

// 简化版本的版本测试组件
interface SimpleVersionTestProps {
  stableVersion: ReactNode;
  betaVersion: ReactNode;
  testName?: string;
}

export function SimpleVersionTest({ stableVersion, betaVersion }: SimpleVersionTestProps) {
  return (
    <VersionTestWrapper
      versions={{
        stable: stableVersion,
        beta: betaVersion
      }}
      fallbackVersion="stable"
    >
      {stableVersion} {/* 默认显示稳定版本 */}
    </VersionTestWrapper>
  );
}

// 版本信息显示组件
export function VersionInfo() {
  // A/B testing removed - no version info available
  return null as any;
}