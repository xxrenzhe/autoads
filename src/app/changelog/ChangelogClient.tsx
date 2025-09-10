"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  BarChart3,
  FileText,
  Globe,
  Languages,
  Layers,
  Monitor,
  Navigation as NavigationIcon,
  Settings,
  Shield,
  Star,
  Zap,
} from "lucide-react";

export default function ChangelogClient() {
  const { t, locale } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Skip to main content for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50"
      >
        Skip to main content
      </a>

      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <section className="text-center mb-6">
          <h1 className="text-center">{t("changelog.title")}</h1>
          <p className="subtitle max-w-2xl mx-auto text-center mt-2 mb-4">
            {t("changelog.description")}
          </p>
        </section>
        {/* 三步卡片区示例（如 changelog 有三步说明可补充，否则可省略） */}

        {/* Version 1.1 */}
        <div className="space-y-8">
          <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="default"
                    className="bg-green-600 text-white px-3 py-1 text-sm"
                  >
                    v1.1.0
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800"
                  >
                    Latest
                  </Badge>
                </div>
                <div className="text-sm text-slate-500">
                  Released: January 2025
                </div>
              </div>
              <CardTitle className="text-2xl text-green-900 mt-3">
                🚀 {t("changelog.v1_1.title")}
              </CardTitle>
              <p className="text-green-700">
                {t("changelog.v1_1.description")}
              </p>
            </CardHeader>

            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    {t("changelog.v1_1.majorFeatures.title")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/70 rounded-lg p-4 border border-green-200">
                      <div className="flex items-center gap-3 mb-2">
                        <Layers className="h-5 w-5 text-green-600" />
                        <h4 className="font-semibold text-slate-900">
                          {t("changelog.v1_1.majorFeatures.dualMode.title")}
                        </h4>
                      </div>
                      <p className="text-sm text-slate-600">
                        {t("changelog.v1_1.majorFeatures.dualMode.description")}
                      </p>
                    </div>

                    <div className="bg-white/70 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center gap-3 mb-2">
                        <Monitor className="h-5 w-5 text-blue-600" />
                        <h4 className="font-semibold text-slate-900">
                          {t(
                            "changelog.v1_1.majorFeatures.progressTracking.title",
                          )}
                        </h4>
                      </div>
                      <p className="text-sm text-slate-600">
                        {t(
                          "changelog.v1_1.majorFeatures.progressTracking.description",
                        )}
                      </p>
                    </div>

                    <div className="bg-white/70 rounded-lg p-4 border border-purple-200">
                      <div className="flex items-center gap-3 mb-2">
                        <BarChart3 className="h-5 w-5 text-purple-600" />
                        <h4 className="font-semibold text-slate-900">
                          {t(
                            "changelog.v1_1.majorFeatures.rankingAnalysis.title",
                          )}
                        </h4>
                      </div>
                      <p className="text-sm text-slate-600">
                        {t(
                          "changelog.v1_1.majorFeatures.rankingAnalysis.description",
                        )}
                      </p>
                    </div>

                    <div className="bg-white/70 rounded-lg p-4 border border-orange-200">
                      <div className="flex items-center gap-3 mb-2">
                        <Languages className="h-5 w-5 text-orange-600" />
                        <h4 className="font-semibold text-slate-900">
                          {t(
                            "changelog.v1_1.majorFeatures.internationalization.title",
                          )}
                        </h4>
                      </div>
                      <p className="text-sm text-slate-600">
                        {t(
                          "changelog.v1_1.majorFeatures.internationalization.description",
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Settings className="h-5 w-5 text-slate-600" />
                    {t("changelog.v1_1.improvements.title")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/70 rounded-lg p-4 border border-indigo-200">
                      <div className="flex items-center gap-3 mb-2">
                        <NavigationIcon className="h-5 w-5 text-indigo-600" />
                        <h4 className="font-semibold text-slate-900">
                          {t("changelog.v1_1.improvements.navigation.title")}
                        </h4>
                      </div>
                      <p className="text-sm text-slate-600">
                        {t(
                          "changelog.v1_1.improvements.navigation.description",
                        )}
                      </p>
                    </div>

                    <div className="bg-white/70 rounded-lg p-4 border border-teal-200">
                      <div className="flex items-center gap-3 mb-2">
                        <FileText className="h-5 w-5 text-teal-600" />
                        <h4 className="font-semibold text-slate-900">
                          {t("changelog.v1_1.improvements.userManual.title")}
                        </h4>
                      </div>
                      <p className="text-sm text-slate-600">
                        {t(
                          "changelog.v1_1.improvements.userManual.description",
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Version 1.0 */}
          <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="default"
                    className="bg-blue-600 text-white px-3 py-1 text-sm"
                  >
                    v1.0.0
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 text-blue-800"
                  >
                    Previous
                  </Badge>
                </div>
                <div className="text-sm text-slate-500">
                  Released: January 2025
                </div>
              </div>
              <CardTitle className="text-2xl text-blue-900 mt-3">
                🎉 {t("changelog.v1.title")}
              </CardTitle>
              <p className="text-blue-700">{t("changelog.v1.description")}</p>
            </CardHeader>

            <CardContent>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  {t("changelog.v1.coreFeatures.title")}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white/70 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center gap-3 mb-2">
                      <Globe className="h-5 w-5 text-blue-600" />
                      <h4>
                        {t("changelog.v1.coreFeatures.batchProcessing.title")}
                      </h4>
                    </div>
                    <p className="text-sm text-slate-600">
                      {t(
                        "changelog.v1.coreFeatures.batchProcessing.description",
                      )}
                    </p>
                  </div>

                  <div className="bg-white/70 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center gap-3 mb-2">
                      <Zap className="h-5 w-5 text-green-600" />
                      <h4>
                        {t("changelog.v1.coreFeatures.simpleWorkflow.title")}
                      </h4>
                    </div>
                    <p className="text-sm text-slate-600">
                      {t(
                        "changelog.v1.coreFeatures.simpleWorkflow.description",
                      )}
                    </p>
                  </div>

                  <div className="bg-white/70 rounded-lg p-4 border border-purple-200">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="h-5 w-5 text-purple-600" />
                      <h4>{t("changelog.v1.coreFeatures.dataExport.title")}</h4>
                    </div>
                    <p className="text-sm text-slate-600">
                      {t("changelog.v1.coreFeatures.dataExport.description")}
                    </p>
                  </div>

                  <div className="bg-white/70 rounded-lg p-4 border border-orange-200">
                    <div className="flex items-center gap-3 mb-2">
                      <Shield className="h-5 w-5 text-orange-600" />
                      <h4>
                        {t("changelog.v1.coreFeatures.privacyFirst.title")}
                      </h4>
                    </div>
                    <p className="text-sm text-slate-600">
                      {t("changelog.v1.coreFeatures.privacyFirst.description")}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
