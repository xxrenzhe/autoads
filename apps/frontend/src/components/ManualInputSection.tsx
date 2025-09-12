import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import type React from "react";

interface ManualInputSectionProps {
  manualUrls: string;
  setManualUrls: (value: string) => void;
  pasteFromClipboard: () => void;
  setShowManualInput: (value: boolean) => void;
  mergeWithAutoDetection: () => void;
  applyManualUrls: () => void;
}

const ManualInputSection: React.FC<ManualInputSectionProps> = ({
  manualUrls,
  setManualUrls,
  pasteFromClipboard,
  setShowManualInput,
  mergeWithAutoDetection,
  applyManualUrls,
}) => {
  const { t, locale } = useLanguage();

  return (
    <Card className="shadow-xl border-0 bg-gradient-to-r from-blue-50 to-indigo-50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-3 text-blue-900">
            📝 手动获取最终URL
          </span>
          <div className="flex gap-2">
            <Button
              onClick={pasteFromClipboard}
              variant="outline"
              size="sm"
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              📋 {t("pasteFromClipboard")}
            </Button>
            <Button
              onClick={() => setShowManualInput(false)}
              variant="outline"
              size="sm"
              className="border-gray-300"
            >
              {"取消" /* 始终显示中文 */}
            </Button>
          </div>
        </CardTitle>
        <CardDescription className="text-blue-800 mb-4">
          <strong>📋 操作步骤：</strong>
          <br />
          1. 切换到浏览器中已打开的标签页
          <br />
          2. 复制地址栏中的最终URL（Ctrl+L → Ctrl+C）
          <br />
          3. 回到本页面，将最终URL粘贴到下方对应的行
          <br />
          4. 重复步骤1-3处理所有标签页
          <br />
          5. 点击"应用最终URL"完成设置
          <br />
          <br />
          <strong>💡 提示：</strong>
          下方已自动生成原始URL列表，请将每行替换为对应的最终URL。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-blue-900 block mb-2">
            最终URL列表（每行一个URL，保持顺序）：
          </label>
          <Textarea
            value={manualUrls}
            onChange={(e) => setManualUrls(e.target.value)}
            className="min-h-32 font-mono text-sm border-blue-200 focus:border-blue-400"
            placeholder="1. https://final-url-1.com&#10;2. https://final-url-2.com&#10;3. https://final-url-3.com"
          />
          <div className="text-xs text-blue-600 mt-1">
            💡 支持格式：直接粘贴URL，或保持 "1. URL" 的编号格式
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            onClick={mergeWithAutoDetection}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            🔄 {t("mergeWithAutoDetection")}
          </Button>
          <Button
            onClick={applyManualUrls}
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-100"
          >
            ✅ {t("applyManualUrls")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ManualInputSection;
