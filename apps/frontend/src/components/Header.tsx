"use client";

import Logo from "@/components/Logo";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSession, signOut } from "next-auth/react";
import { ArrowLeft, Menu, X, User, LogOut } from "lucide-react";
import { LoginButton } from "@/components/auth/LoginButton";
import { UserProfileModal } from "@/components/auth/UserProfileModal";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

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

interface HeaderProps {
  currentPage?: string;
  showBackButton?: boolean;
  backButtonHref?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export default function Header({
  currentPage = "home",
  showBackButton = false,
  backButtonHref = "/",
  subtitle,
  children,
}: .*Props) {
  const { t, locale } = useLanguage();
  const { data: session, status } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  return (
    <header
      className="bg-white/90 backdrop-blur-md border-b border-blue-100 sticky top-0 z-50"
      role="banner"
    >
      <div className="max-w-6xl mx-auto px-4 py-3 lg:py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Logo, Title, and Back Button */}
          <div className="flex items-center space-x-2 lg:space-x-4 flex-1 min-w-0">
            {showBackButton && (
              <Link
                href={backButtonHref}
                title={locale === "zh" ? "返回首页" : "Back to Home"}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:bg-blue-50 transition-all duration-200 hover:scale-105 flex-shrink-0 h-8 lg:h-9 px-2 lg:px-3"
                >
                  <ArrowLeft
                    className="h-4 w-4 mr-1 lg:mr-2"
                    aria-hidden="true"
                  />
                  <span className="hidden sm:inline">
                    {locale === "zh" ? "返回首页" : "Back to Home"}
                  </span>
                  <span className="sm:hidden">
                    {locale === "zh" ? "返回" : "Back"}
                  </span>
                </Button>
              </Link>
            )}

            <Logo
              size="md"
              showText={true}
            />
          </div>

          {/* Right side - Navigation, Auth, and Mobile Menu */}
          <div className="flex items-center space-x-2 lg:space-x-0">
            {/* Desktop Navigation */}
            <div className="hidden lg:block">
              <Navigation currentPage={currentPage} />
            </div>

            {/* Mobile Auth Buttons - Only visible on mobile */}
            <div className="flex items-center space-x-2 lg:hidden">
              {status === "loading" ? (
                <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
              ) : session ? (
                <>
                    <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowProfileModal(true)}
                  >
                    <User className="h-4 w-4 mr-2" />
                    {session.user?.name || session.user?.email}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => signOut()}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <LoginButton
                  variant="outline"
                  size="sm"
                  title="登录 AutoAds"
                  description="使用 Google 账户登录，享受完整的自动化营销功能"
                >
                  登录
                </LoginButton>
              )}
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
              aria-label={
                isMobileMenuOpen
                  ? (locale === "zh" ? "关闭菜单" : "Close Menu")
                  : (locale === "zh" ? "打开菜单" : "Open Menu")
              }
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden mt-4 pt-4 border-t border-blue-100 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <Navigation currentPage={currentPage} />
            
            {/* Mobile Auth Buttons */}
            <div className="flex flex-col space-y-2 pt-2 border-t border-blue-100">
              {status === "loading" ? (
                <div className="w-full h-10 bg-gray-200 rounded animate-pulse" />
              ) : session ? (
                <>
                    
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start"
                    onClick={() => setShowProfileModal(true)}
                  >
                    <User className="h-4 w-4 mr-2" />
                    个人中心
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => signOut()}
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    退出登录
                  </Button>
                </>
              ) : (
                <LoginButton
                  variant="outline"
                  className="w-full"
                  title="登录 AutoAds"
                  description="使用 Google 账户登录，享受完整的自动化营销功能"
                  fullWidth
                >
                  使用 Google 登录
                </LoginButton>
              )}
            </div>
          </div>
        )}

        {/* Additional content slot */}
        {children && <div className="mt-4">{children}</div>}
      </div>

      {/* 个人中心弹窗 */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </header>
  );
}
