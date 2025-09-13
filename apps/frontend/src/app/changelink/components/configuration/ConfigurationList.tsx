'use client';

import { useState } from 'react';
import { 
  Settings, 
  Play, 
  Pause, 
  Clock, 
  Trash2, 
  Edit, 
  Copy, 
  MoreHorizontal,
  Calendar,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Plus
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';

import { TrackingConfiguration } from '../../types';
import { ExecutionStatusIndicator } from '../LoadingStates';
import { EmptyState } from '@/components/ErrorBoundary';

interface ConfigurationListProps {
  configurations: TrackingConfiguration[];
  isLoading?: boolean;
  onAddNew: () => void;
  onEdit: (config: TrackingConfiguration) => void;
  onDuplicate: (config: TrackingConfiguration) => void;
  onDelete: (config: TrackingConfiguration) => void;
  onExecute: (config: TrackingConfiguration) => void;
  onRefresh?: () => void;
}

export default function ConfigurationList({
  configurations,
  isLoading = false,
  onAddNew,
  onEdit,
  onDuplicate,
  onDelete,
  onExecute,
  onRefresh
}: ConfigurationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedConfigs, setSelectedConfigs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('grid');

  // 过滤配置
  const filteredConfigurations = configurations.filter((config: any) => {
    // 搜索过滤
    const matchesSearch = searchQuery === '' || 
      config.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.environmentId?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // 状态过滤
    const matchesStatus = statusFilter === 'all' || config.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  // 处理选择配置
  const handleSelectConfig = (configId: string) => {
    setSelectedConfigs(prev => {
      if (prev.includes(configId)) {
        return prev.filter((id: any) => id !== configId);
      } else {
        return [...prev, configId];
      }
    });
  };

  // 处理全选
  const handleSelectAll = () => {
    if (selectedConfigs.length === filteredConfigurations.length) {
      setSelectedConfigs([]);
    } else {
      setSelectedConfigs(filteredConfigurations?.filter(Boolean)?.map((config: any) => config.id));
    }
  };

  // 获取总广告数
  const getTotalAds = (config: TrackingConfiguration) => {
    return config.googleAdsAccounts.reduce((total, account: any) => {
      return total + (account.campaignMappings?.reduce((campaignTotal, campaign: any) => {
        return campaignTotal + (campaign.adGroupMappings?.reduce((adGroupTotal, adGroup: any) => {
          return adGroupTotal + (adGroup.adMappings?.length || 0);
        }, 0) || 0);
      }, 0) || 0);
    }, 0);
  };

  // 渲染网格视图
  const renderGridView = () => {
    if (filteredConfigurations.length === 0) {
      return (
        <EmptyState
          icon={Filter}
          title="没有匹配的配置"
          description="尝试调整搜索条件或清除过滤器"
          action={{
            label: "清除过滤器",
            onClick: () => {
              setSearchQuery('');
              setStatusFilter('all');
            }
          }}
        />
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredConfigurations?.filter(Boolean)?.map((config: any) => (
          <Card 
            key={config.id} 
            className={`hover:shadow-md transition-shadow ${selectedConfigs.includes(config.id) ? 'ring-2 ring-blue-500' : ''}`}
          >
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    checked={selectedConfigs.includes(config.id)}
                    onCheckedChange={((: any): any) => handleSelectConfig(config.id)}
                    className="mt-1"
                  />
                  <div>
                    <CardTitle className="text-lg">{config.name}</CardTitle>
                    <p className="text-sm text-gray-500">{config.environmentId}</p>
                  </div>
                </div>
                <ExecutionStatusIndicator 
                  status={config.status === 'stopped' ? 'pending' : 
                         config.status === 'active' ? 'running' :
                         config.status === 'paused' ? 'paused' :
                         'pending'}
                  showLabel={false}
                  size="sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Google Ads账户</p>
                    <p className="font-medium">{config.googleAdsAccounts.length}个账户</p>
                  </div>
                  <div>
                    <p className="text-gray-500">广告数量</p>
                    <p className="font-medium">{getTotalAds(config)}个广告</p>
                  </div>
                  <div>
                    <p className="text-gray-500">原始链接</p>
                    <p className="font-medium">{config.originalLinks.length}个链接</p>
                  </div>
                  <div>
                    <p className="text-gray-500">重复次数</p>
                    <p className="font-medium">{config.repeatCount}次</p>
                  </div>
                </div>

                {config.schedulingConfig?.enabled && (
                  <div className="flex items-center text-xs text-blue-600 bg-blue-50 p-2 rounded">
                    <Calendar className="h-3 w-3 mr-1" />
                    <span>
                      {config.schedulingConfig.frequency === 'daily' ? '每日' : 
                       config.schedulingConfig.frequency === 'weekly' ? '每周' : '自定义'} 
                      {config.schedulingConfig.time} 执行
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <div className="text-xs text-gray-500">
                    {config.lastExecuted ? (
                      <span>上次执行: {new Date(config.lastExecuted).toLocaleString()}</span>
                    ) : (
                      <span>尚未执行</span>
                    )}
                  </div>
                  
                  <div className="flex space-x-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={((: any): any) => onEdit(config)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      编辑
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={((: any): any) => onExecute(config)}>
                          <Play className="h-4 w-4 mr-2" />
                          执行
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={((: any): any) => onDuplicate(config)}>
                          <Copy className="h-4 w-4 mr-2" />
                          复制
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={((: any): any) => onDelete(config)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  // 渲染表格视图
  const renderTableView = () => {
    if (filteredConfigurations.length === 0) {
      return (
        <EmptyState
          icon={Filter}
          title="没有匹配的配置"
          description="尝试调整搜索条件或清除过滤器"
          action={{
            label: "清除过滤器",
            onClick: () => {
              setSearchQuery('');
              setStatusFilter('all');
            }
          }}
        />
      );
    }

    return (
      <div className="border rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="p-2 text-left">
                <Checkbox
                  checked={selectedConfigs.length === filteredConfigurations.length && filteredConfigurations.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </th>
              <th className="p-2 text-left">名称</th>
              <th className="p-2 text-left">状态</th>
              <th className="p-2 text-left">账户数</th>
              <th className="p-2 text-left">广告数</th>
              <th className="p-2 text-left">调度</th>
              <th className="p-2 text-left">上次执行</th>
              <th className="p-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredConfigurations?.filter(Boolean)?.map((config: any) => (
              <tr 
                key={config.id} 
                className={`hover:bg-slate-50 ${selectedConfigs.includes(config.id) ? 'bg-blue-50' : ''}`}
              >
                <td className="p-2">
                  <Checkbox
                    checked={selectedConfigs.includes(config.id)}
                    onCheckedChange={((: any): any) => handleSelectConfig(config.id)}
                  />
                </td>
                <td className="p-2">
                  <div>
                    <p className="font-medium">{config.name}</p>
                    <p className="text-xs text-gray-500">{config.environmentId}</p>
                  </div>
                </td>
                <td className="p-2">
                  <ExecutionStatusIndicator 
                    status={config.status === 'stopped' ? 'pending' : 
                           config.status === 'active' ? 'running' :
                           config.status === 'paused' ? 'paused' :
                           'pending'}
                    showLabel={true}
                    size="sm"
                  />
                </td>
                <td className="p-2">{config.googleAdsAccounts.length}</td>
                <td className="p-2">{getTotalAds(config)}</td>
                <td className="p-2">
                  {config.schedulingConfig?.enabled ? (
                    <div className="flex items-center text-xs">
                      <Clock className="h-3 w-3 mr-1 text-blue-600" />
                      <span>
                        {config.schedulingConfig.frequency === 'daily' ? '每日' : 
                         config.schedulingConfig.frequency === 'weekly' ? '每周' : '自定义'} 
                        {config.schedulingConfig.time}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400">未设置</span>
                  )}
                </td>
                <td className="p-2 text-xs text-gray-500">
                  {config.lastExecuted ? new Date(config.lastExecuted).toLocaleString() : '尚未执行'}
                </td>
                <td className="p-2">
                  <div className="flex space-x-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={((: any): any) => onEdit(config)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={((: any): any) => onExecute(config)}>
                          <Play className="h-4 w-4 mr-2" />
                          执行
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={((: any): any) => onDuplicate(config)}>
                          <Copy className="h-4 w-4 mr-2" />
                          复制
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={((: any): any) => onDelete(config)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">加载配置中...</span>
      </div>
    );
  }

  if (configurations.length === 0) {
    return (
      <EmptyState
        icon={Settings}
        title="暂无配置"
        description="创建您的第一个Google Ads自动化配置"
        action={{
          label: "创建配置",
          onClick: onAddNew
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 搜索和过滤栏 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="搜索配置名称或环境ID..."
              value={searchQuery}
              onChange={((e: any): any) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="running">运行中</SelectItem>
              <SelectItem value="scheduled">已调度</SelectItem>
              <SelectItem value="stopped">已停止</SelectItem>
              <SelectItem value="error">错误</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-2">
          {onRefresh && (
            <Button variant="outline" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
          )}
          
          <Button onClick={onAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            新建配置
          </Button>
        </div>
      </div>

      {/* 批量操作栏 */}
      {selectedConfigs.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
          <span className="text-sm text-blue-700">
            已选择 {selectedConfigs.length} 个配置
          </span>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm">
              批量执行
            </Button>
            <Button variant="outline" size="sm">
              批量删除
            </Button>
          </div>
        </div>
      )}

      {/* 视图切换和内容 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="grid">网格视图</TabsTrigger>
          <TabsTrigger value="table">表格视图</TabsTrigger>
        </TabsList>
        
        <TabsContent value="grid" className="mt-6">
          {renderGridView()}
        </TabsContent>
        
        <TabsContent value="table" className="mt-6">
          {renderTableView()}
        </TabsContent>
      </Tabs>
    </div>
  );
}