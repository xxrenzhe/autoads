'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Settings, 
  BarChart3, 
  Clock, 
  Download, 
  Bell, 
  Menu, 
  X,
  Home,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import dynamic from "next/dynamic";
const ErrorBoundary = dynamic(() => import("@/components/ErrorBoundary"), { ssr: false });
interface LayoutProps {
  children: React.ReactNode;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
  description: string;
}

interface SystemStatus {
  isOnline: boolean;
  runningConfigurations: number;
  scheduledTasks: number;
  lastUpdate: Date;
  errors: number;
}

const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: '仪表板',
    icon: Home,
    href: '/adscenter',
    description: '系统概览和快速操作'
  },
  {
    id: 'configurations',
    label: '配置管理',
    icon: Settings,
    href: '/adscenter/configurations',
    description: '创建和管理跟踪配置'
  },
  {
    id: 'monitoring',
    label: '执行监控',
    icon: BarChart3,
    href: '/adscenter/executions',
    description: '实时监控执行状态'
  },
  {
    id: 'scheduling',
    label: '定时任务',
    icon: Clock,
    href: '/adscenter/scheduling',
    description: '管理定时执行任务'
  },
  {
    id: 'exports',
    label: '数据导出',
    icon: Download,
    href: '/adscenter/exports',
    description: '导出执行结果和报告'
  },
  {
    id: 'notifications',
    label: '通知设置',
    icon: Bell,
    href: '/adscenter/notifications',
    description: '配置邮件通知和警报'
  }
];

export default function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    isOnline: true,
    runningConfigurations: 0,
    scheduledTasks: 0,
    lastUpdate: new Date(),
    errors: 0
   });
  
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  // 模拟系统状态更新
  useEffect(() => {
    const updateSystemStatus = () => {
      setSystemStatus(prev => ({
        ...prev,
        lastUpdate: new Date(),
        runningConfigurations: Math.floor(Math.random() * 5),
        scheduledTasks: Math.floor(Math.random() * 10),
        errors: Math.floor(Math.random() * 3)
      }));
    };

    // 初始加载
    setTimeout(() => {
      setIsLoading(false);
      updateSystemStatus();
    }, 1000);

    // 定期更新状态
    const interval = setInterval(updateSystemStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // 获取当前页面信息
  const getCurrentPage = () => {
    const currentItem = navigationItems.find((item: any) => 
      pathname === item.href || (item.href !== '/adscenter' && pathname.startsWith(item.href))
    );
    return currentItem || navigationItems[0];
  };

  // 生成面包屑导航
  const getBreadcrumbs = () => {
    const currentPage = getCurrentPage();
    const breadcrumbs = [
      { label: 'Google Ads自动化', href: '/adscenter' }
    ];

    if (currentPage.href !== '/adscenter') { breadcrumbs.push({ label: currentPage.label, href: currentPage.href });
    }

    return breadcrumbs;
  };

  const currentPage = getCurrentPage();
  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* 左侧：Logo和菜单按钮 */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden mr-2"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-label="打开菜单"
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <h1 className="text-xl font-bold text-gray-900">
                    Google Ads自动化
                  </h1>
                </div>
                
                {/* 系统状态指示器 */}
                <div className="ml-4 flex items-center">
                  {systemStatus.isOnline ? (
                    <div className="flex items-center text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      <span className="text-sm font-medium">在线</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-red-600">
                      <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                      <span className="text-sm font-medium">离线</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 右侧：状态信息 */}
            <div className="flex items-center space-x-4">
              {/* 运行状态 */}
              <div className="hidden sm:flex items-center space-x-4">
                {systemStatus.runningConfigurations > 0 && (
                  <div className="flex items-center text-green-600">
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    <span className="text-sm">{systemStatus.runningConfigurations} 运行中</span>
                  </div>
                )}
                
                {systemStatus.scheduledTasks > 0 && (
                  <div className="flex items-center text-blue-600">
                    <Clock className="h-4 w-4 mr-1" />
                    <span className="text-sm">{systemStatus.scheduledTasks} 已调度</span>
                  </div>
                )}
                
                {systemStatus.errors > 0 && (
                  <div className="flex items-center text-red-600">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span className="text-sm">{systemStatus.errors} 错误</span>
                  </div>
                )}
              </div>

              {/* 最后更新时间 */}
              <div className="text-xs text-gray-500 hidden md:block">
                更新于 {systemStatus.lastUpdate.toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* 侧边栏 */}
        <aside className={`
          fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex flex-col h-full">
            {/* 侧边栏头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 lg:hidden">
              <h2 className="text-lg font-semibold text-gray-900">导航菜单</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarOpen(false)}
                aria-label="关闭菜单"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* 导航菜单 */}
            <nav className="flex-1 px-4 py-6 space-y-2">
              {navigationItems.map((item: any) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/adscenter' && pathname.startsWith(item.href));
                
                return (
                    <Link
                      key={item.id}
                      href={item.href}
                    className={`
                      flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                      ${isActive 
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                      onClick={() => setIsSidebarOpen(false)}
                    >
                    <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <Badge variant="secondary" className="ml-2">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* 系统状态卡片 */}
            <div className="p-4 border-t border-gray-200">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">系统状态</span>
                    {systemStatus.isOnline ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>运行中:</span>
                      <span>{systemStatus.runningConfigurations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>已调度:</span>
                      <span>{systemStatus.scheduledTasks}</span>
                    </div>
                    {systemStatus.errors > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>错误:</span>
                        <span>{systemStatus.errors}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </aside>

        {/* 主内容区域 */}
        <main className="flex-1 lg:ml-0">
          {/* 面包屑导航 */}
          <div className="bg-white border-b border-gray-200">
            <div className="px-4 sm:px-6 lg:px-8 py-4">
              <nav className="flex items-center space-x-2 text-sm">
                {breadcrumbs.map((crumb, index: any) => (
                  <div key={crumb.href} className="flex items-center">
                    {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400 mx-2" />}
                    <Link
                      href={crumb.href}
                      className={`
                        ${index === breadcrumbs.length - 1 
                          ? 'text-gray-900 font-medium' 
                          : 'text-gray-500 hover:text-gray-700'
                        }
                      `}
                    >
                      {crumb.label}
                    </Link>
                  </div>
                ))}
              </nav>
              
              {/* 页面标题和描述 */}
              <div className="mt-2">
                <h1 className="text-2xl font-bold text-gray-900">{currentPage.label}</h1>
                <p className="text-gray-600 mt-1">{currentPage.description}</p>
              </div>
            </div>
          </div>

          {/* 页面内容 */}
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            {isLoading ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-gray-600">加载中...</p>
                </div>
              </div>
            ) : (
              <ErrorBoundary>{children}</ErrorBoundary>
            )}
          </div>
        </main>
      </div>

      {/* 移动端遮罩层 */}
      {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
      )}
    </div>
  );
}
