/**
 * 用户体验增强组件
 * 提供统一的加载状态、错误处理、成功提示等UX组件
 */

import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Loader2, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  Activity
} from 'lucide-react';

// 加载状态组件
export const LoadingState: React.FC<{
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}> = ({ message = '加载中...', size = 'md', fullScreen = false }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const containerClasses = fullScreen 
    ? 'fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50'
    : 'flex items-center justify-center py-12';

  return (
    <div className={containerClasses}>
      <div className="text-center">
        <Loader2 className={`${sizeClasses[size]} animate-spin mx-auto mb-4 text-blue-600`} />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
};

// 错误状态组件
export const ErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
  showRetry?: boolean;
}> = ({ 
  title = '出现错误', 
  message, 
  onRetry, 
  showRetry = true 
}) => {
  return (
    <Card className="border-red-200">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <XCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium mb-2 text-red-800">{title}</h3>
        <p className="text-red-600 mb-4 text-center max-w-md">{message}</p>
        {showRetry && onRetry && (
          <Button onClick={onRetry} variant="outline" className="border-red-300 text-red-700">
            <RefreshCw className="h-4 w-4 mr-2" />
            重试
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

// 空状态组件
export const EmptyState: React.FC<{
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}> = ({ 
  icon: Icon = Activity, 
  title, 
  description, 
  action 
}) => {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Icon className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium mb-2">{title}</h3>
        <p className="text-gray-600 mb-4 text-center max-w-md">{description}</p>
        {action && (
          <Button onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

// 成功提示组件
export const SuccessAlert: React.FC<{
  message: string;
  onClose?: () => void;
}> = ({ message, onClose }) => {
  return (
    <Alert className="border-green-200 bg-green-50">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <AlertDescription className="text-green-800">
        {message}
        {onClose && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="ml-2 h-auto p-0 text-green-600 hover:text-green-800"
          >
            ×
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

// 警告提示组件
export const WarningAlert: React.FC<{
  message: string;
  onClose?: () => void;
}> = ({ message, onClose }) => {
  return (
    <Alert className="border-yellow-200 bg-yellow-50">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="text-yellow-800">
        {message}
        {onClose && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="ml-2 h-auto p-0 text-yellow-600 hover:text-yellow-800"
          >
            ×
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

// 错误提示组件
export const ErrorAlert: React.FC<{
  message: string;
  onClose?: () => void;
}> = ({ message, onClose }) => {
  return (
    <Alert className="border-red-200 bg-red-50">
      <XCircle className="h-4 w-4 text-red-600" />
      <AlertDescription className="text-red-800">
        {message}
        {onClose && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="ml-2 h-auto p-0 text-red-600 hover:text-red-800"
          >
            ×
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

// 网络状态指示器
export const NetworkStatus: React.FC<{
  isOnline: boolean;
}> = ({ isOnline }) => {
  return (
    <div className={`flex items-center gap-2 text-sm ${
      isOnline ? 'text-green-600' : 'text-red-600'
    }`}>
      {isOnline ? (
        <Wifi className="h-4 w-4" />
      ) : (
        <WifiOff className="h-4 w-4" />
      )}
      <span>{isOnline ? '在线' : '离线'}</span>
    </div>
  );
};

// 进度指示器
export const ProgressIndicator: React.FC<{
  current: number;
  total: number;
  label?: string;
}> = ({ current, total, label }) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex justify-between text-sm">
          <span>{label}</span>
          <span>{current}/{total} ({percentage}%)</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// 状态徽章
export const StatusBadge: React.FC<{
  status: 'success' | 'error' | 'warning' | 'info' | 'pending';
  label: string;
}> = ({ status, label }) => {
  const variants = {
    success: 'bg-green-100 text-green-800 border-green-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    pending: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Activity,
    pending: Clock
  };

  const Icon = icons[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${variants[status]}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
};

// 页面头部组件
export const PageHeader: React.FC<{
  title: string;
  description?: string;
  actions?: React.ReactNode;
}> = ({ title, description, actions }) => {
  return (
    <div className="flex justify-between items-start mb-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        {description && (
          <p className="text-gray-600">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
};

// 确认对话框Hook
export const useConfirmDialog = () => {
  const confirm = (message: string, title: string = '确认操作'): Promise<boolean> => {
    return new Promise((resolve) => {
      const result = window.confirm(`${title}\n\n${message}`);
      resolve(result);
    });
  };

  return { confirm };
};

// 通知Hook
export const useNotification = () => {
  const [notifications, setNotifications] = React.useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
  }>>([]);

  const addNotification = React.useCallback((
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    duration: number = 5000
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const notification = { id, type, message, duration };
    
    setNotifications(prev => [...prev, notification]);
    if (duration > 0) => {
      setTimeout(() => {
        setNotifications(prev => prev.filter((n: any) => n.id !== id));
      }, duration);
    }
  }, []);

  const removeNotification = React.useCallback((id: string) => {
    setNotifications(prev => prev.filter((n: any) => n.id !== id));
  }, []);

  const NotificationContainer = React.useCallback(() => (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications?.filter(Boolean)?.map((notification: any) => {
        const AlertComponent = {
          success: SuccessAlert,
          error: ErrorAlert,
          warning: WarningAlert,
          info: SuccessAlert // 使用成功样式作为信息样式
        }[notification.type];

        return (
          <AlertComponent
            key={notification.id}
            message={notification.message}
            onClose={() => removeNotification(notification.id)}
          />
        );
      })}
    </div>
  ), [notifications, removeNotification]);
  return {
    addNotification,
    removeNotification,
    NotificationContainer
  };
};

// 网络状态Hook
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};