import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { formatProgress, estimateRemainingTime } from './utils';

interface ProgressDisplayProps {
  progress: number;
  total: number;
  status: string;
  error: string;
  isProcessing: boolean;
  startTime?: number;
  locale: string;
}

export const ProgressDisplay: React.FC<ProgressDisplayProps> = ({
  progress,
  total,
  status,
  error,
  isProcessing,
  startTime,
  locale
}) => {
  const progressPercentage = total > 0 ? (progress / total) * 100 : 0;
  const isComplete = progress === total && total > 0;
  const hasError = !!error;
  
  const remainingTime = startTime && isProcessing && progress > 0 
    ? estimateRemainingTime(progress, total, startTime)
    : null;

  return (
    <Card className={`transition-all duration-200 ${
      hasError ? 'border-red-200 bg-red-50' : 
      isComplete ? 'border-green-200 bg-green-50' : 
      isProcessing ? 'border-blue-200 bg-blue-50' : ''
    }`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {isProcessing ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          ) : hasError ? (
            <AlertCircle className="h-5 w-5 text-red-600" />
          ) : isComplete ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <Clock className="h-5 w-5 text-gray-400" />
          )}
          
          {locale === "zh" ? "打开进度" : "Opening Progress"}
          
          <Badge variant={
            hasError ? "destructive" : 
            isComplete ? "default" : 
            isProcessing ? "secondary" : "outline"
          }>
            {formatProgress(progress, total)}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 进度条 */}
        <div className="space-y-2">
          <Progress 
            value={progressPercentage} 
            className={`h-3 ${
              hasError ? '[&>div]:bg-red-500' : 
              isComplete ? '[&>div]:bg-green-500' : 
              '[&>div]:bg-blue-500'
            }`}
          />
          
          <div className="flex justify-between text-sm text-slate-600">
            <span>
              {progress} / {total} {locale === "zh" ? "已完成" : "completed"}
            </span>
            {remainingTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {locale === "zh" ? `剩余 ${remainingTime}` : `${remainingTime} remaining`}
              </span>
            )}
          </div>
        </div>

        {/* 状态信息 */}
        {status && (
          <div className={`text-sm p-3 rounded-md ${
            hasError ? 'bg-red-100 text-red-800' :
            isComplete ? 'bg-green-100 text-green-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {status}
          </div>
        )}

        {/* 错误信息 */}
        {error && (
          <div className="text-sm p-3 rounded-md bg-red-100 text-red-800 border border-red-200">
            <div className="flex items-center gap-2 font-medium mb-1">
              <AlertCircle className="h-4 w-4" />
              {locale === "zh" ? "错误" : "Error"}
            </div>
            {error}
          </div>
        )}

        {/* 完成信息 */}
        {isComplete && !hasError && (
          <div className="text-sm p-3 rounded-md bg-green-100 text-green-800 border border-green-200">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle className="h-4 w-4" />
              {locale === "zh" 
                ? `成功打开 ${total} 个URL` 
                : `Successfully opened ${total} URLs`
              }
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};