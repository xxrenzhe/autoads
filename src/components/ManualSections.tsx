"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AlertCircle,
  BarChart3,
  CheckCircle,
  Download,
  Globe,
  Info,
  Rocket,
  Settings,
  Shield,
  Star,
  Zap,
} from "lucide-react";

// Helper function to safely handle translation arrays
const getTranslationArray = (value: string | string[]): string[] => {
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
};

const ManualSections = () => {
  const { t, locale } = useLanguage();

  return (
    <div className="space-y-8">
      {/* Overview Section */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          {t("manual.overview.title")}
        </h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-700 leading-relaxed">
              {t("manual.overview.description")}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Quick Start Section */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          {t("manual.quickStart.title")}
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-800"
                >
                  1
                </Badge>
                {"输入URL" /* 始终显示中文 */}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">{t("manual.quickStart.step1")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800"
                >
                  2
                </Badge>
                {"自动分析" /* 始终显示中文 */}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">{t("manual.quickStart.step2")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="bg-purple-100 text-purple-800"
                >
                  3
                </Badge>
                {"查看结果" /* 始终显示中文 */}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">{t("manual.quickStart.step3")}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          {t("manual.features.title")}
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {t("manual.features.batchProcessing.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">
                {t("manual.features.batchProcessing.description")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("manual.features.siteRanking.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">
                {t("manual.features.siteRanking.description")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("manual.features.manualOverride.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">
                {t("manual.features.manualOverride.description")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("manual.features.dataExport.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">
                {t("manual.features.dataExport.description")}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Use Cases Section */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          {t("manual.useCases.title")}
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-800"
                >
                  {"开发者" /* 始终显示中文 */}
                </Badge>
                {t("manual.useCases.developers.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-slate-600">
                {getTranslationArray(t("manual.useCases.developers.items")).map(
                  (item: string) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ),
                )}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800"
                >
                  {"营销" /* 始终显示中文 */}
                </Badge>
                {t("manual.useCases.marketers.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-slate-600">
                {getTranslationArray(t("manual.useCases.marketers.items")).map(
                  (item: string) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ),
                )}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-red-100 text-red-800">
                  {"安全" /* 始终显示中文 */}
                </Badge>
                {t("manual.useCases.security.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-slate-600">
                {getTranslationArray(t("manual.useCases.security.items")).map(
                  (item: string) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-red-500 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ),
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Tips Section */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          {t("manual.tips.title")}
        </h2>
        <Card>
          <CardContent className="pt-6">
            <ul className="space-y-3">
              {getTranslationArray(t("manual.tips.items")).map(
                (tip: string) => (
                  <li key={tip} className="flex items-start gap-3">
                    <span className="text-blue-500 mt-1">💡</span>
                    <span className="text-slate-700">{tip}</span>
                  </li>
                ),
              )}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Troubleshooting Section */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          {t("manual.troubleshooting.title")}
        </h2>
        <Card>
          <CardContent className="pt-6">
            <ul className="space-y-3">
              {getTranslationArray(t("manual.troubleshooting.items")).map(
                (item: string) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="text-amber-500 mt-1">⚠️</span>
                    <span className="text-slate-700">{item}</span>
                  </li>
                ),
              )}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default ManualSections;
