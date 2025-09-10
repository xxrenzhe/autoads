import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { processFile } from '@/lib/siterank/fileProcessor';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('FileUpload');

interface FileUploadProps {
  onFileProcessed: (data: { domains: string[]; columns: string[]; rows: Record<string, string>[] }) => void;
  onError: (error: string) => void;
  onFileSelected?: (fileName: string) => void;
  locale: string;
  t: (key: string) => string | string[];
  fileName?: string;
  fileError?: string;
  fileDomains?: string[];
  duplicateCount?: number;
  batchQueryLimit?: number;
}

// Helper function to safely get translation string
const getTranslationString = (t: (key: string) => string | string[], key: string): string => {
  const result = t(key);
  return Array.isArray(result) ? result[0] : result;
};

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileProcessed,
  onError,
  onFileSelected,
  locale,
  t,
  fileName,
  fileError,
  fileDomains,
  duplicateCount,
  batchQueryLimit = 100
}) => {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    try {
      onError(""); // 清除之前的错误
      // 先设置文件名
      if (onFileSelected) {
        onFileSelected(file.name);
      }
      const result = await processFile(file, locale, batchQueryLimit);
      onFileProcessed(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('文件处理错误:', new EnhancedError('文件处理错误:', { error: errorMessage  }));
      console.error("FileUpload error details:", {
        error,
        errorType: typeof error,
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined
      });
      onError(errorMessage || "文件处理失败");
    }
  }, [onFileProcessed, onError, onFileSelected, locale]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  // 判断是否有文件上传成功
  const hasFile = fileName && !fileError;
  
  return (
    <div
      {...getRootProps()}
      className={`h-full border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors flex flex-col justify-center ${
        isDragActive
          ? "border-emerald-400 bg-emerald-50"
          : hasFile
          ? "border-green-300 bg-green-50"
          : fileError
          ? "border-red-300 bg-red-50"
          : "border-gray-300 hover:border-emerald-400 hover:bg-emerald-50"
      }`}
    >
      <input {...getInputProps()} />
      
      {hasFile ? (
        // 文件上传成功状态 - 保持简洁，不扩大高度
        <div className="space-y-2">
          <p className="text-green-700 font-medium text-sm">
            已上传：{fileName}
          </p>
          {fileDomains && fileDomains.length > 0 && (
            <p className="text-green-600 text-xs">
              文件包含 {fileDomains.length} 个域名
              {typeof duplicateCount === 'number' && duplicateCount > 0 && (
                <span className="text-green-700 ml-1">
                  (去重后 {fileDomains.length - duplicateCount} 个，{duplicateCount} 个重复)
                </span>
              )}
              {fileDomains.length > batchQueryLimit * 0.8 && (
                <span className="text-orange-600 font-medium ml-1">
                  ⚠️ 接近限制（最多 {batchQueryLimit} 个）
                </span>
              )}
            </p>
          )}
        </div>
      ) : fileError ? (
        // 文件上传错误状态 - 保持简洁
        <div className="space-y-2">
          <p className="text-red-700 font-medium text-sm">
            上传失败
          </p>
          <p className="text-red-600 text-xs">{fileError}</p>
        </div>
      ) : (
        // 默认上传状态 - 去除大图标，保持简洁
        <div className="space-y-2">
          <p className="text-gray-600 text-sm">
            {isDragActive
              ? "放下文件以上传"
              : getTranslationString(t, "siterank.fileUpload.dragOrClick")}
          </p>
          <p className="text-xs text-slate-400">
            {getTranslationString(t, "siterank.fileUpload.supported")}
          </p>
          <p className="text-xs text-gray-500">
            最多支持 {batchQueryLimit} 个域名
          </p>
        </div>
      )}
    </div>
  );
};