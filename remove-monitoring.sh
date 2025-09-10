#!/bin/bash

# 移除不必要的监控告警系统
echo "=== 移除不必要的监控告警系统 ==="

# 1. 创建备份目录
mkdir -p backup/removed-monitoring

# 2. 记录将要移除的文件
echo "以下文件将被移除或重命名："
echo ""

# 监控相关的核心文件
MONITORING_FILES=(
    "src/lib/enhanced-memory-monitor.ts"
    "src/lib/execution-monitor.ts"
    "src/lib/security/real-time-alert-system.ts"
    "src/lib/services/service-monitoring-service.ts"
    "src/lib/services/task-monitor-service.ts"
    "src/lib/services/memory-pressure-monitor.ts"
    "src/lib/services/integration-health-monitor.ts"
    "src/lib/services/api-health-service.ts"
    "src/lib/services/performance-monitor.ts"
    "src/lib/memory-pressure-monitor.ts"
    "src/lib/performance/monitor.ts"
    "src/lib/monitoring/alert-manager.ts"
    "src/lib/monitoring/metrics-collector.ts"
    "src/lib/monitoring/health-checker.ts"
    "src/lib/monitoring/performance.ts"
    "src/lib/security/api-monitoring.ts"
    "src/lib/middleware/api-monitor.ts"
    "src/lib/middleware/enhanced-api-middleware.ts"
    "src/lib/middleware/performance-monitor.ts"
    "src/lib/middleware/memory-protection.ts"
    "src/lib/middleware/api-logger.ts"
)

# 通知相关文件
NOTIFICATION_FILES=(
    "src/lib/services/notification-service.ts"
    "src/infrastructure/notifications/NotificationService.ts"
    "src/lib/services/notification/email-service.ts"
    "src/lib/services/notification/providers/mailgun-provider.ts"
    "src/lib/services/notification-trigger-service.ts"
    "src/shared/store/notification-store.ts"
    "src/shared/components/notifications"
    "src/user/components/notifications"
    "src/admin/components/notifications"
)

# 3. 移动文件到备份目录而不是删除
echo "移动监控文件到备份目录..."
for file in "${MONITORING_FILES[@]}"; do
    if [ -f "$file" ]; then
        mkdir -p backup/removed-monitoring/$(dirname $file)
        mv "$file" "backup/removed-monitoring/$file"
        echo "✅ 已移动: $file"
    fi
done

echo ""
echo "移动通知文件到备份目录..."
for file in "${NOTIFICATION_FILES[@]}"; do
    if [ -f "$file" ] || [ -d "$file" ]; then
        mkdir -p backup/removed-monitoring/$(dirname $file)
        mv "$file" "backup/removed-monitoring/$file"
        echo "✅ 已移动: $file"
    fi
done

# 4. 更新引用这些文件的代码
echo ""
echo "5. 更新引用这些文件的代码..."

# 4.1 更新 db/index.ts，移除监控初始化
cat > src/lib/db/index.ts << 'EOF'
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// 导出初始化函数
export async function initializeDatabase() {
  try {
    // 测试数据库连接
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// 优雅关闭
export async function shutdownDatabase() {
  await prisma.$disconnect();
}
EOF

# 4.2 创建简化的 StateProvider
cat > src/shared/providers/StateProvider.tsx << 'EOF'
'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function StateProvider({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
EOF

# 4.3 创建简化的 crash logger
cat > src/lib/crash-logger.ts << 'EOF'
export class CrashLogger {
  initialize(): void {
    // 只监听未捕获的异常
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled Rejection:', reason);
    });
  }
}

export const crashLogger = new CrashLogger();
EOF

# 5. 清理 AdminApp.tsx 中的监控引用
if [ -f "src/admin/AdminApp.tsx" ]; then
    # 备份原文件
    cp src/admin/AdminApp.tsx backup/removed-monitoring/src/admin/AdminApp.tsx.backup
    
    # 移除监控相关的导入和组件
    sed -i '' '/SystemMonitoringDashboard/d' src/admin/AdminApp.tsx
    sed -i '' '/MonitoringDashboard/d' src/admin/AdminApp.tsx
    sed -i '' '/useSystemMonitoring/d' src/admin/AdminApp.tsx
fi

# 6. 清理用户仪表板中的通知引用
if [ -f "src/user/components/dashboard/UserDashboard.tsx" ]; then
    cp src/user/components/dashboard/UserDashboard.tsx backup/removed-monitoring/src/user/components/dashboard/UserDashboard.tsx.backup
    
    # 移除通知组件导入
    sed -i '' '/NotificationCenter/d' src/user/components/dashboard/UserDashboard.tsx
    sed -i '' '/NotificationPreferences/d' src/user/components/dashboard/UserDashboard.tsx
fi

echo ""
echo "✅ 监控告警系统移除完成"
echo ""
echo "主要改动："
echo "1. 移除了所有监控服务（内存、性能、API等）"
echo "2. 移除了通知系统和相关组件"
echo "3. 简化了 StateProvider，只保留必要的查询客户端"
echo "4. 简化了数据库初始化，移除监控启动"
echo ""
echo "备份文件保存在: backup/removed-monitoring/"
echo "如需恢复，可以从备份目录复制文件回来"