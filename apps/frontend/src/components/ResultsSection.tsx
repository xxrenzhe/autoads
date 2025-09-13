"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import type { UrlResult } from '@/types/common';
import { Check, Copy, Edit, ExternalLink } from "lucide-react";
import { useState } from "react";
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createClientLogger('ResultsSection');

interface ResultsSectionProps {
  results: UrlResult[];
  onEditFinalUrl: (index: number, newUrl: string) => void;
  onCopyFinalUrls: () => void;
  onExportText: () => void;
  onExportCsv: () => void;
  isExporting: boolean;
}

const ResultsSection = ({
  results,
  onEditFinalUrl,
  onCopyFinalUrls,
  onExportText,
  onExportCsv,
  isExporting,
}: ResultsSectionProps) => {
  const { t, locale } = useLanguage();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleEdit = (index: number, currentUrl: string) => {
    setEditingIndex(index);
    setEditValue(currentUrl);
  };

  const handleSave = (index: number) => {
    onEditFinalUrl(index, editValue);
    setEditingIndex(null);
    setEditValue("");
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      logger.error('Failed to copy:', new EnhancedError('Failed to copy:', { error: err instanceof Error ? err.message : String(err)
       }));
    }
  };

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
  const failedResults = results.filter((r: any) => {
    const status = r.status;
    if (typeof status === "number") {
      return status >= 400 || status === null;
    }
    return (
      status === "failed" || status === "blocked" || status === "invalidUrl"
    );
  });

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t("results")}</span>
            <div className="flex gap-2 text-sm">
              <Badge variant="outline">
                {t("totalUrls")}: {results.length}
              </Badge>
              <Badge variant="default">
                {t("successfulUrls")}: {successfulResults.length}
              </Badge>
            </div>
          </CardTitle>
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
              {t("exportText")}
            </Button>
            <Button
              onClick={onExportCsv}
              disabled={isExporting}
              variant="outline"
              size="sm"
            >
              {t("exportCsv")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("results")}</CardTitle>
          <CardDescription>
            {"URL处理结果详情" /* 始终显示中文 */}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("url")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("finalUrl")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, index: any) => (
                  <TableRow key={result.originalUrl}>
                    <TableCell className="font-mono text-sm max-w-xs truncate">
                      {result.originalUrl}
                    </TableCell>
                    <TableCell>{getStatusBadge(result.status ?? null)}</TableCell>
                    <TableCell className="font-mono text-sm max-w-xs">
                      {editingIndex === index ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={((e: any): any) => setEditValue(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border rounded"
                            autoFocus
                          />
                          <Button size="sm" onClick={((: any): any) => handleSave(index)}>
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancel}
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="truncate">
                            {result.finalUrl || "-"}
                          </span>
                          {result.finalUrl && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={((: any): any) =>
                                  result.finalUrl &&
                                  copyToClipboard(result.finalUrl, index)
                                }
                              >
                                {copiedIndex === index ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={((: any): any) =>
                                  window.open(result.finalUrl, "_blank")
                                }
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={((: any): any) =>
                            handleEdit(index, result.finalUrl || "")
                          }
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          {t("editFinalUrl")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Details */}
      {successfulResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {"分析详情" /* 始终显示中文 */}
            </CardTitle>
            <CardDescription>
              {"成功处理的URL详细信息" /* 始终显示中文 */}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {successfulResults.map((result, index: any) => (
                <div key={result.originalUrl} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">
                      {result.originalUrl}
                    </h4>
                    {getStatusBadge(result.status ?? null)}
                  </div>
                  {result.finalUrl &&
                    result.finalUrl !== result.originalUrl && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">
                          {"结果: " /* 始终显示中文 */}
                        </span>
                        <span className="font-mono">{result.finalUrl}</span>
                      </div>
                    )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Details */}
      {failedResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {"错误详情" /* 始终显示中文 */}
            </CardTitle>
            <CardDescription>
              {"处理失败的URL及错误信息" /* 始终显示中文 */}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {failedResults.map((result, index: any) => (
                <div
                  key={result.originalUrl}
                  className="border rounded-lg p-4 bg-red-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">
                      {result.originalUrl}
                    </h4>
                    {getStatusBadge(result.status ?? null)}
                  </div>
                  {result.error && (
                    <div className="text-sm text-red-600">
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
      )}
    </div>
  );
};

export default ResultsSection;
