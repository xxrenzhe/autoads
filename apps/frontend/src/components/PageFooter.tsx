"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { APP_CONFIG } from "@/lib/config";
import Link from "next/link";

const PageFooter = () => {
  const { t, isLoading } = useLanguage();

  return (
    <footer className="text-center py-8 text-slate-500 border-t border-slate-200">
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm">
            © 2025{" "}
            <span className="font-semibold text-blue-600">
              {APP_CONFIG.site.name}
            </span>{" "}
            - {isLoading ? "Loading..." : t("title")}
          </p>
          <p className="text-xs">{isLoading ? "Loading..." : t("subtitle")}</p>
        </div>

        {/* Footer Navigation Links */}
        <div className="flex flex-wrap justify-center gap-4 text-xs">
          <Link
            href="/about"
            className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            {isLoading ? "About" : t("footer.about")}
          </Link>
          <span className="text-slate-300">|</span>
          <Link
            href="/contact"
            className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            {isLoading ? "Contact" : t("footer.contact")}
          </Link>
          <span className="text-slate-300">|</span>
          <Link
            href="/privacy"
            className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            {isLoading ? "Privacy" : t("footer.privacy")}
          </Link>
          <span className="text-slate-300">|</span>
          <Link
            href="/terms"
            className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            {isLoading ? "Terms" : t("footer.terms")}
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default PageFooter;
