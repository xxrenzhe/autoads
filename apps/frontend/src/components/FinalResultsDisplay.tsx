import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import type { UrlResult } from '@/types/common';
import { Copy, Download, ExternalLink } from "lucide-react";

interface FinalResultsDisplayProps {
  results: UrlResult[];
  onCopyFinalUrls: () => void;
  onExportText: () => void;
  onExportCsv: () => void;
  isExporting: boolean;
}

const FinalResultsDisplay = ({
  results,
  onCopyFinalUrls,
  onExportText,
  onExportCsv,
  isExporting,
}: FinalResultsDisplayProps) => {
  const { t, locale } = useLanguage();

  const getStatusBadge = (status: string | number | null) => {
    // Convert number status to string status
    let statusStr: string;
    if (typeof status === "number") {
      if (status >= 200 && status < 300) {
        statusStr = "success";
      } else if (status >= 300 && status < 400) {
        statusStr = "opened";
      } else {
        statusStr = "failed";
      }
    } else if (status === null) {
      statusStr = "waitingDetection";
    } else {
      statusStr = status;
    }

    const statusConfig = {
      success: { variant: "default" as const, text: t("success") },
      failed: { variant: "destructive" as const, text: t("failed") },
      opened: { variant: "default" as const, text: t("opened") },
      blocked: { variant: "secondary" as const, text: t("blocked") },
      invalidUrl: { variant: "outline" as const, text: t("invalidUrl") },
      waitingDetection: {
        variant: "secondary" as const,
        text: t("waitingDetection"),
      },
    };

    const config =
      statusConfig[statusStr as keyof typeof statusConfig] ||
      statusConfig.failed;
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const successfulResults = results.filter((r: any) => {
    const status = r.status;
    if (typeof status === "number") {
      return status >= 200 && status < 400;
    }
    return status === "success" || status === "opened";
  });

  const finalUrls = successfulResults
    .map((r: any) => r.finalUrl || r.originalUrl)
    .filter((url): url is string => !!url)
    .filter((url, index, arr: any) => arr.indexOf(url) === index); // Remove duplicates

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {"最终结果摘要" /* 始终显示中文 */}
            </span>
            <div className="flex gap-2 text-sm">
              <Badge variant="outline">
                {t("totalUrls")}: {results.length}
              </Badge>
              <Badge variant="default">
                {t("successfulUrls")}: {successfulResults.length}
              </Badge>
              <Badge variant="secondary">
                {t("finalUrls")}: {finalUrls.length}
              </Badge>
            </div>
          </CardTitle>
          <CardDescription>
            {"成功处理的URL最终地址列表" /* 始终显示中文 */}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button onClick={onCopyFinalUrls} variant="outline" size="sm">
              <Copy className="w-4 h-4 mr-2" />
              {t("copyFinalUrls")}
            </Button>
            <Button
              onClick={onExportText}
              disabled={isExporting}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              {t("exportText")}
            </Button>
            <Button
              onClick={onExportCsv}
              disabled={isExporting}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              {t("exportCsv")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Final URLs List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {"最终URL列表" /* 始终显示中文 */}
          </CardTitle>
          <CardDescription>
            {"去重后的最终URL地址" /* 始终显示中文 */}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {finalUrls.map((url, index: any) => (
              <div
                key={url}
                className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm truncate">{url}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {"最终地址" /* 始终显示中文 */} #{index + 1}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={((: any): any) => navigator.clipboard.writeText(url)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={((: any): any) => window.open(url, "_blank")}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <Card>
        <CardHeader>
          <CardTitle>
            {"详细结果" /* 始终显示中文 */}
          </CardTitle>
          <CardDescription>
            {"所有URL的处理结果详情" /* 始终显示中文 */}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {results.map((result, index: any) => (
              <div key={result.originalUrl} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm truncate flex-1">
                    {result.originalUrl}
                  </h4>
                  <div className="ml-4">{getStatusBadge(result.status ?? null)}</div>
                </div>
                {result.finalUrl && result.finalUrl !== result.originalUrl && (
                  <div className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">
                      {"最终URL: " /* 始终显示中文 */}
                    </span>
                    <span className="font-mono">{result.finalUrl}</span>
                  </div>
                )}

                {result.error && (
                  <div className="text-sm text-red-600 mt-2">
                    <span className="font-medium">
                      {"错误: " /* 始终显示中文 */}
                    </span>
                    <span>{result.error}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinalResultsDisplay;
