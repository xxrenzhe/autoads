"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Bell, Sparkles } from "lucide-react";

export default function InsightsHubPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Insights</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" /> 评估与趋势（Siterank）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              查看 10 秒评估、相似机会与历史趋势。支持按 Offer 拉取最新评估结果并跟踪变化。
            </p>
            <div className="flex items-center gap-3">
              <Link href="/siterank">
                <Button><Sparkles className="h-4 w-4 mr-2" />打开 Siterank</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-green-600" /> 通知与预警
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              查看系统事件、评估降级与操作提醒。支持未读状态与最近动态的实时查看。
            </p>
            <div className="flex items-center gap-3">
              <Link href="/notifications">
                <Button variant="outline">查看通知</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

