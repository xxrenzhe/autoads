"use client";

import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSession, signIn, signOut } from "next-auth/react";
import { useAuthContext } from "@/contexts/AuthContext";
import { BarChart3, FileText, Globe, Menu, X, History, Activity, Settings, MoreHorizontal, Users, CreditCard, Database, LogIn, LogOut, User } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";

const LazyLanguageSwitcher = dynamic(
  () => import("@/components/LanguageSwitcher"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-gray-300 rounded animate-pulse" />
        <div className="flex rounded-lg border border-gray-200 bg-white">
          <div className="h-8 w-8 bg-gray-200 rounded-l-md animate-pulse" />
          <div className="h-8 w-8 bg-gray-200 rounded-r-md animate-pulse" />
        </div>
      </div>
    ),
  },
);

// Helper function to ensure translation values are strings
function getStr(val: string | string[]): string {
  return Array.isArray(val) ? val.join("") : val;
}

interface NavigationProps {
  currentPage?: string;
}

export default function Navigation({ currentPage = "home" }: NavigationProps) {
  const { t, locale, displayLocale, isLoading } = useLanguage();
  const { data: session } = useSession();
  const { openLoginModal, openUserCenterModal } = useAuthContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // 如果语言还在加载中，显示加载状态
  if (isLoading) {
    return (
      <nav className="hidden lg:flex items-center space-x-6">
        <div className="flex items-center space-x-6 text-sm text-slate-600">
          <div className="flex items-center space-x-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center space-x-1 px-3 py-2">
                <div className="w-4 h-4 bg-gray-300 rounded animate-pulse" />
                <div className="w-16 h-4 bg-gray-300 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <LazyLanguageSwitcher />
        </div>
      </nav>
    );
  }

  // 主要导航项目（保留在导航栏中）- 始终显示中文
  const navItems = [
    { href: "/", label: "首页", icon: Globe, color: "blue" },
    {
      href: "/batchopen",
      label: "真实点击", // 始终显示中文
      icon: FileText,
      color: "blue",
    },
    {
      href: "/siterank",
      label: "网站排名", // 始终显示中文
      icon: BarChart3,
      color: "green",
    },
    {
      href: "/adscenter",
      label: "自动化广告", // 始终显示中文
      icon: FileText,
      color: "purple",
    },
    {
      href: "/pricing",
      label: "价格", // 价格页面
      icon: CreditCard,
      color: "green",
    },
  ];

  // 下拉菜单项目（移入"更多"菜单）- 始终显示中文
  const dropdownItems = [
    { 
      href: "/changelog", 
      label: "更新日志", // 始终显示中文
      icon: History, 
      color: "purple", 
      description: "最新功能与版本发布" // 始终显示中文
    },
  ];

  
  const getColorClasses = (color: string, isActive = false, disabled = false) => {
    if (disabled) {
      return "text-gray-400 cursor-not-allowed";
    }

    const baseClasses = {
      blue: "text-slate-700 hover:text-blue-600 hover:bg-blue-50",
      green: "text-slate-700 hover:text-green-600 hover:bg-green-50",
      purple: "text-slate-700 hover:text-purple-600 hover:bg-purple-50",
      orange: "text-slate-700 hover:text-orange-600 hover:bg-orange-50",
      red: "text-slate-700 hover:text-red-600 hover:bg-red-50",
      gray: "text-gray-400 cursor-not-allowed",
    };

    const activeClasses = {
      blue: "text-blue-600 bg-blue-50",
      green: "text-green-600 bg-green-50",
      purple: "text-purple-600 bg-purple-50",
      orange: "text-orange-600 bg-orange-50",
      red: "text-red-600 bg-red-50",
      gray: "text-gray-400 cursor-not-allowed",
    };

    return isActive
      ? activeClasses[color as keyof typeof activeClasses]
      : baseClasses[color as keyof typeof baseClasses];
  };

  const getMobileColorClasses = (color: string) => {
    return {
      blue: "bg-blue-50/50 text-blue-700 hover:bg-blue-100/70",
      green: "bg-green-50/50 text-green-700 hover:bg-green-100/70",
      purple: "bg-purple-50/50 text-purple-700 hover:bg-purple-100/70",
      orange: "bg-orange-50/50 text-orange-700 hover:bg-orange-100/70",
      red: "bg-red-50/50 text-red-700 hover:bg-red-100/70",
    }[color as keyof typeof getMobileColorClasses];
  };

  // 检查下拉菜单中是否有激活的项目
  const hasActiveDropdownItem = dropdownItems.some(item => pathname === item.href);

  return (
    <>
      {/* Desktop Navigation */}
      <nav
        className="hidden lg:flex items-center space-x-6"
        aria-label="主导航" /* 始终显示中文 */
      >
        <div className="flex items-center space-x-6 text-sm text-slate-600">
          {/* Navigation Links */}
          <div className="flex items-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || (item.href === "/" && pathname === "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-all duration-200 hover:scale-105 ${getColorClasses(item.color, isActive)}`}
                  title={getStr(item.label)}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{getStr(item.label)}</span>
                </Link>
              );
            })}
            
            {/* 更多菜单下拉框 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-all duration-200 hover:scale-105 ${
                    hasActiveDropdownItem 
                      ? "text-blue-600 bg-blue-50" 
                      : "text-slate-700 hover:text-blue-600 hover:bg-blue-50"
                  }`}
                  title="更多" /* 始终显示中文 */
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="font-medium">更多</span> {/* 始终显示中文 */}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {dropdownItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link
                        href={item.href}
                        className={`flex items-center space-x-2 w-full ${
                          isActive ? "bg-blue-50 text-blue-600" : ""
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <div className="flex flex-col">
                          <span className="font-medium">{getStr(item.label)}</span>
                          <span className="text-xs text-muted-foreground">{item.description}</span>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center space-x-4">
            <LazyLanguageSwitcher />
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session.user?.image} alt={session.user?.name} />
                      <AvatarFallback>
                        {session.user?.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{session.user?.name}</p>
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        {session.user?.email}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuItem onClick={openUserCenterModal}>
                    <User className="mr-2 h-4 w-4" />
                    <span>个人中心</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>退出登录</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openLoginModal(undefined, pathname)}
                className="flex items-center space-x-2"
              >
                <LogIn className="h-4 w-4" />
                <span>登录</span>
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="flex lg:hidden items-center space-x-2">
        <div className="hidden sm:block">
          <LazyLanguageSwitcher />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
          aria-label={
            isMobileMenuOpen
              ? "关闭菜单" /* 始终显示中文 */
              : "打开菜单" /* 始终显示中文 */
          }
        >
          {isMobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-md border-b border-blue-100 shadow-lg z-40">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="grid grid-cols-1 gap-2">
              {/* 主要导航项目 */}
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href === "/" && pathname === "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 hover:scale-105 ${getMobileColorClasses(item.color)} ${isActive ? "ring-2 ring-blue-200" : ""}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="h-5 w-5" />
                    <div>
                      <div className="font-medium text-sm">
                        {getStr(item.label)}
                      </div>
                      <div className="text-xs opacity-75">
                        {item.href === "/" && "URL分析与批量处理"}
                        {item.href === "/batchopen" && "云端真实点击工具"} {/* 始终显示中文 */}
                        {item.href === "/adscenter" && "智能广告管理平台"} {/* 始终显示中文 */}
                        {item.href === "/siterank" && "网站排名分析与优先级计算"}
                        {item.href === "/pricing" && "订阅计划和价格信息"}
                        {item.href === "/adscenter/settings" && "系统配置和设置管理"} {/* 始终显示中文 */}
                      </div>
                    </div>
                  </Link>
                );
              })}
              
              {/* 分隔线 */}
              <div className="border-t border-gray-200 my-2"></div>
              
              {/* 下拉菜单项目 */}
              {dropdownItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 hover:scale-105 ${getMobileColorClasses(item.color)} ${isActive ? "ring-2 ring-blue-200" : ""}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="h-5 w-5" />
                    <div>
                      <div className="font-medium text-sm">
                        {getStr(item.label)}
                      </div>
                      <div className="text-xs opacity-75">
                        {item.description}
                      </div>
                    </div>
                  </Link>
                );
              })}
              </div>
            
            {/* User menu for mobile */}
            {session ? (
              <div className="px-3 py-2 space-y-2">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={session.user?.image} alt={session.user?.name} />
                    <AvatarFallback>
                      {session.user?.name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{session.user?.name}</p>
                    <p className="text-sm text-gray-500">{session.user?.email}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center space-x-2"
                  onClick={openUserCenterModal}
                >
                  <User className="h-4 w-4" />
                  <span>个人中心</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center space-x-2"
                  onClick={() => signOut()}
                >
                  <LogOut className="h-4 w-4" />
                  <span>退出登录</span>
                </Button>
              </div>
            ) : (
              <div className="px-3 py-2">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center space-x-2"
                  onClick={() => openLoginModal(undefined, pathname)}
                >
                  <LogIn className="h-4 w-4" />
                  <span>使用 Google 登录</span>
                </Button>
              </div>
            )}
            
            <div className="flex justify-center pt-4 sm:hidden">
              <LazyLanguageSwitcher />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
