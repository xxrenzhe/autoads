import { useLanguage } from "@/contexts/LanguageContext";
import Image from "next/image";
import Link from "next/link";
import type React from "react";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = "", size = "md", showText = true }) => {
  const { t, isLoading } = useLanguage();

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-20 h-20",
  };

  const textSizeClasses = {
    sm: "text-[18px]",
    md: "text-[18px]",
    lg: "text-[18px]",
    xl: "text-[18px]",
  };

  return (
    <Link
      href="/"
      className="flex items-center space-x-3 group transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
      title="返回首页"
      aria-label="点击返回首页"
    >
      {/* Logo图标 */}
      <div className={`${sizeClasses[size]} ${className} flex-shrink-0`}>
        <Image
          src="/logo-autoads.png"
          alt="AutoAds Logo"
          width={48}
          height={48}
          className="w-full h-full object-contain"
          priority={true}
        />
      </div>

      {/* Logo文字 */}
      {showText && (
        <div className="flex flex-col min-w-0">
          <h1 className={`${textSizeClasses[size]} font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent group-hover:from-blue-700 group-hover:to-indigo-700 transition-all duration-200`}>
            {isLoading ? "AutoAds" : t("logo.brandName")}
          </h1>
          <p className={`text-[14px] text-slate-600 group-hover:text-slate-700 transition-colors duration-200 -mt-1 ${size === 'sm' ? 'hidden' : ''}`}>
            {isLoading ? "一站式自动化营销平台" : t("logo.tagline")}
          </p>
        </div>
      )}
    </Link>
  );
};

export default Logo;
