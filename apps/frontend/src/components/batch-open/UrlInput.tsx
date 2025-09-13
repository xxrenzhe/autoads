import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { parseUrls } from './utils';

interface UrlInputProps {
  input: string;
  onInputChange: (value: string) => void;
  locale: string;
  t: (key: string) => string | string[];
}

export const UrlInput: React.FC<UrlInputProps> = ({
  input,
  onInputChange,
  locale,
  t
}) => {
  const urls = parseUrls(input);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-700">
          {locale === "zh" ? "URL 列表" : "URL List"}
        </h3>
        <Badge variant="secondary" className="text-sm">
          {urls.length} {locale === "zh" ? "个URL" : "URLs"}
        </Badge>
      </div>
      
      <Textarea
        placeholder={
          locale === "zh"
            ? "请输入要打开的URL，每行一个：\n\nhttps://example1.com\nhttps://example2.com\nhttps://example3.com"
            : "Enter URLs to open, one per line:\n\nhttps://example1.com\nhttps://example2.com\nhttps://example3.com"
        }
        value={input}
        onChange={((e: any): any) => onInputChange(e.target.value)}
        className="min-h-[200px] font-mono text-sm"
      />
      
      {urls.length > 0 && (
        <div className="text-sm text-slate-600">
          {locale === "zh" 
            ? `已识别 ${urls.length} 个有效URL`
            : `${urls.length} valid URLs identified`
          }
        </div>
      )}
      
      {input.trim() && urls.length === 0 && (
        <div className="text-sm text-red-600">
          {locale === "zh" 
            ? "未找到有效的URL，请检查格式"
            : "No valid URLs found, please check the format"
          }
        </div>
      )}
    </div>
  );
};