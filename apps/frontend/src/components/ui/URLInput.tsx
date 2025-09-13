/**
 * URL Input Component
 * 专门处理URL输入和验证
 */

import React, { useState, useCallback, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, X, CheckCircle, AlertCircle, FileText, Link } from 'lucide-react';
import { validateUrlList, isMaliciousUrl, sanitizeInput } from '@/lib/utils/validation';

interface URLInputProps {
  value: string;
  onChange: (urls: string[]) => void;
  onError?: (error: string) => void;
  maxUrls?: number;
  placeholder?: string;
  className?: string;
  showStats?: boolean;
  allowFileUpload?: boolean;
}

interface ParsedURL {
  original: string;
  normalized: string;
  valid: boolean;
  error?: string;
}

export function URLInput({
  value,
  onChange,
  onError,
  maxUrls = 1000,
  placeholder = '请输入URL，每行一个...',
  className = '',
  showStats = false,
  allowFileUpload = true
}: URLInputProps) {
  const [inputText, setInputText] = useState(value);
  const [parsedURLs, setParsedURLs] = useState<ParsedURL[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 解析和验证URLs
  const parseURLs = useCallback((text: string): ParsedURL[] => {
    const lines = text.split('\n').filter((line: any) => line.trim());
    const result: ParsedURL[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const sanitized = sanitizeInput(line);
      
      try {
        // 检查恶意URL
        if (isMaliciousUrl(sanitized)) {
          result.push({
            original: line,
            normalized: sanitized,
            valid: false,
            error: '包含恶意内容'
          });
          continue;
        }
        
        // 验证URL格式
        const url = new URL(sanitized);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          result.push({
            original: line,
            normalized: sanitized,
            valid: false,
            error: '仅支持HTTP/HTTPS协议'
          });
          continue;
        }
        
        // 验证主机名
        if (!url.hostname || url.hostname.includes('..')) {
          result.push({
            original: line,
            normalized: sanitized,
            valid: false,
            error: '无效的主机名'
          });
          continue;
        }
        
        result.push({
          original: line,
          normalized: url.toString(),
          valid: true
        });
        
      } catch (error) {
        result.push({
          original: line,
          normalized: sanitized,
          valid: false,
          error: 'URL格式无效'
        });
      }
    }
    
    return result;
  }, []);

  // 处理输入变化
  const handleInputChange = useCallback((text: string) => {
    setInputText(text);
    
    if (!text.trim()) {
      setParsedURLs([]);
      onChange([]);
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const parsed = parseURLs(text);
      setParsedURLs(parsed);
      
      const validURLs = parsed.filter((u: any) => u.valid)?.filter(Boolean)?.map((u: any) => u.normalized);
      const invalidURLs = parsed.filter((u: any) => !u.valid);
      
      // 检查数量限制
      if (validURLs.length > maxUrls) {
        onError?.(`URL数量超过限制（最多${maxUrls}个）`);
        return;
      }
      
      // 如果有无效URL，报告第一个错误
      if (invalidURLs.length > 0) {
        onError?.(invalidURLs[0].error || '部分URL格式无效');
      }
      
      onChange(validURLs);
      
    } catch (error) {
      onError?.('URL解析失败');
      console.error('URL parsing error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [parseURLs, onChange, onError, maxUrls]);

  // 处理文件上传
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.includes('text') && !file.name.endsWith('.txt') && !file.name.endsWith('.csv')) {
      onError?.('请上传文本文件（.txt或.csv）');
      return;
    }
    
    try {
      const text = await file.text();
      handleInputChange(text);
    } catch (error) {
      onError?.('文件读取失败');
      console.error('File reading error:', error);
    }
  }, [handleInputChange, onError]);

  // 拖拽处理
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }, [handleFileUpload]);

  // 文件选择处理
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  }, [handleFileUpload]);

  // 清除所有URLs
  const handleClear = useCallback(() => {
    setInputText('');
    setParsedURLs([]);
    onChange([]);
  }, [onChange]);

  // 统计信息
  const validCount = parsedURLs.filter((u: any) => u.valid).length;
  const invalidCount = parsedURLs.filter((u: any) => !u.valid).length;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <Link className="w-5 h-5" />
            <span>URL输入</span>
          </span>
          {showStats && (
            <div className="flex items-center space-x-2">
              <Badge variant="default" className="bg-green-100 text-green-800">
                {validCount} 有效
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive">
                  {invalidCount} 无效
                </Badge>
              )}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 文件上传区域 */}
        {allowFileUpload && (
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
              dragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-2">
              拖拽文件到此处或点击上传
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={((: any): any) => fileInputRef.current?.click()}
            >
              <FileText className="w-4 h-4 mr-2" />
              选择文件
            </Button>
          </div>
        )}
        
        {/* 文本输入区域 */}
        <div className="space-y-2">
          <Textarea
            value={inputText}
            onChange={((e: any): any) => handleInputChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[200px] font-mono text-sm"
            disabled={isProcessing}
          />
          
          {/* 操作按钮 */}
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500">
              {parsedURLs.length > 0 && (
                <span>
                  共 {parsedURLs.length} 个URL
                  {validCount > 0 && `，${validCount} 个有效`}
                  {invalidCount > 0 && `，${invalidCount} 个无效`}
                </span>
              )}
            </div>
            
            {inputText && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={isProcessing}
              >
                <X className="w-4 h-4 mr-2" />
                清除
              </Button>
            )}
          </div>
        </div>
        
        {/* 错误信息 */}
        {invalidCount > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              发现 {invalidCount} 个无效URL。请检查URL格式是否正确。
            </AlertDescription>
          </Alert>
        )}
        
        {/* URL列表预览 */}
        {showStats && parsedURLs.length > 0 && (
          <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
            <div className="space-y-1">
              {parsedURLs.slice(0, 10).map((url, index: any) => (
                <div
                  key={index}
                  className="flex items-center space-x-2 text-sm"
                >
                  {url.valid ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`truncate ${url.valid ? '' : 'text-red-600'}`}>
                    {url.original}
                  </span>
                </div>
              ))}
              {parsedURLs.length > 10 && (
                <div className="text-xs text-gray-500 text-center">
                  ... 还有 {parsedURLs.length - 10} 个URL
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}