"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useAuthContext } from '@/contexts/AuthContext';
import { UI_CONSTANTS } from '@/components/ui/ui-constants';
import { ProtectedButton } from '@/components/auth/ProtectedButton';
import { SimpleProgressBar } from '@/components/ui/SimpleProgressBar';
import AutoClickProgressMonitor from '@/components/AutoClickProgressMonitor';
import { AlertCircle, CheckCircle, Clock, Play, Pause, Square, Settings, BarChart3, Lock } from 'lucide-react';
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits';
import Link from 'next/link';

interface AutoClickTask {
  id: string;
  offerUrl: string;
  country: string;
  timeWindow: string;
  dailyClicks: number;
  referer: string;
  status: 'pending' | 'running' | 'terminated';
  createdAt: string;
  todayProgress?: {
    target: number;
    completed: number;
    percentage: number;
  };
}

interface AutoClickBatchProps {
  locale: string;
  t: (key: string) => string | string[];
}

export default function AutoClickBatch({ locale, t }: AutoClickBatchProps) {
  const { data: session } = useSession();
  const { openLoginModal } = useAuthContext();
  const { data: subscriptionLimits, loading: limitsLoading } = useSubscriptionLimits();
  const [tasks, setTasks] = useState<AutoClickTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [monitoringTaskId, setMonitoringTaskId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    offerUrl: '',
    country: 'US',
    timeWindow: '06:00-24:00',
    dailyClicks: 100,
    referer: 'https://google.com'
  });

  // Check if user has access to autoclick version
  const hasAutoClickAccess = subscriptionLimits?.limits?.batchopen?.versions?.includes('autoclick') || false;

  // 获取任务列表
  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/autoclick/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchTasks();
    } else {
      setLoading(false);
      setTasks([]);
    }
  }, [session]);

  // 创建任务
  const handleCreateTask = async () => {
    if (!session) return;

    setCreating(true);
    try {
      const response = await fetch('/api/autoclick/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setFormData({
          offerUrl: '',
          country: 'US',
          timeWindow: '06:00-24:00',
          dailyClicks: 100,
          referer: 'https://google.com'
        });
        setShowForm(false);
        fetchTasks();
      } else {
        const error = await response.json();
        alert(error.error || '创建任务失败');
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('创建任务失败');
    } finally {
      setCreating(false);
    }
  };

  // 更新任务状态
  const handleUpdateTaskStatus = async (taskId: string, action: 'start' | 'pause' | 'terminate') => {
    try {
      const response = await fetch(`/api/autoclick/tasks/${taskId}/${action}`, {
        method: 'POST'
      });

      if (response.ok) {
        fetchTasks();
      } else {
        const error = await response.json();
        alert(error.error || '操作失败');
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      alert('操作失败');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'terminated': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return '已启动';
      case 'pending': return '未启动';
      case 'terminated': return '已终止';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Play className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'terminated': return <Square className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const isLoggedIn = !!session;

  return (
    <div className="space-y-6">
  
      
      {/* 创建任务按钮 */}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-900">自动化点击任务</h3>
        <button
          onClick={((: any): any) => {
            if (!session) {
              openLoginModal('autoclick');
            } else if (!hasAutoClickAccess) {
              window.location.href = '/pricing';
            } else {
              setShowForm(!showForm);
            }
          }}
          className={`${UI_CONSTANTS.buttons.primary} flex items-center gap-2`}
        >
          <Settings className="w-4 h-4" />
          {showForm ? '取消' : '新增任务'}
        </button>
      </div>

      {/* 创建任务表单 */}
      {showForm && (
        <div className={`${UI_CONSTANTS.cards.simple} p-6`}>
          <h4 className="text-lg font-medium mb-4">创建新任务</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                目标URL *
              </label>
              <input
                type="url"
                value={formData.offerUrl}
                onChange={((e: any): any) => setFormData({ ...formData, offerUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                国家/地区
              </label>
              <select
                value={formData.country}
                onChange={((e: any): any) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="US">美国</option>
                <option value="CN">中国</option>
                <option value="UK">英国</option>
                <option value="JP">日本</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                执行时间段
              </label>
              <select
                value={formData.timeWindow}
                onChange={((e: any): any) => setFormData({ ...formData, timeWindow: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="00:00-24:00">全天 (00:00-24:00)</option>
                <option value="06:00-24:00">日间 (06:00-24:00)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                每日点击次数 *
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={formData.dailyClicks}
                onChange={((e: any): any) => setFormData({ ...formData, dailyClicks: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Referer
              </label>
              <input
                type="url"
                value={formData.referer}
                onChange={((e: any): any) => setFormData({ ...formData, referer: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://google.com"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={((: any): any) => setShowForm(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              取消
            </button>
            <ProtectedButton
              featureName="autoclick"
              onClick={handleCreateTask}
              disabled={creating || !formData.offerUrl}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? '创建中...' : '创建任务'}
            </ProtectedButton>
          </div>
        </div>
      )}

      {/* 任务列表 */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className={`${UI_CONSTANTS.cards.simple} p-8 text-center`}>
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {!isLoggedIn 
              ? '登录后可创建自动化点击任务' 
              : !hasAutoClickAccess 
                ? '请联系管理员开通自动化点击功能权限' 
                : '暂无任务，点击上方按钮创建新任务'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task: any) => (
            <div key={task.id} className={`${UI_CONSTANTS.cards.simple} p-6`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                      {getStatusIcon(task.status)}
                      {getStatusText(task.status)}
                    </span>
                    <span className="text-sm text-gray-500">
                      创建于 {new Date(task.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">目标URL</p>
                      <p className="font-medium text-sm truncate">{task.offerUrl}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">每日点击</p>
                      <p className="font-medium">{task.dailyClicks.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">时间段</p>
                      <p className="font-medium">{task.timeWindow}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Referer</p>
                      <p className="font-medium text-sm truncate">{task.referer}</p>
                    </div>
                  </div>

                  {/* 今日进度 */}
                  {task.todayProgress && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">今日进度</span>
                        <span className="font-medium">
                          {task.todayProgress.completed} / {task.todayProgress.target} 
                          ({task.todayProgress.percentage}%)
                        </span>
                      </div>
                      <SimpleProgressBar 
                        progress={task.todayProgress.completed}
                        total={task.todayProgress.target}
                        isOpening={false}
                        isTerminated={task.status === 'terminated'}
                        className="h-2"
                      />
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="flex flex-col gap-2 ml-4">
                  <div className="flex gap-2">
                    {task.status === 'pending' && (
                      <div className="group relative">
                        {hasAutoClickAccess ? (
                          <ProtectedButton
                            featureName="autoclick"
                            onClick={((: any): any) => handleUpdateTaskStatus(task.id, 'start')}
                            className="p-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-100"
                          >
                            <Play className="w-4 h-4" />
                          </ProtectedButton>
                        ) : (
                          <Link
                            href="/pricing"
                            className="p-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-100 flex items-center justify-center"
                            title="升级到Max以使用此功能"
                          >
                            <Lock className="w-4 h-4" />
                          </Link>
                        )}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                          启动任务
                        </div>
                      </div>
                    )}
                    {task.status === 'running' && (
                      <div className="group relative">
                        {hasAutoClickAccess ? (
                          <ProtectedButton
                            featureName="autoclick"
                            onClick={((: any): any) => handleUpdateTaskStatus(task.id, 'terminate')}
                            className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                          >
                            <Square className="w-4 h-4" />
                          </ProtectedButton>
                        ) : (
                          <Link
                            href="/pricing"
                            className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 flex items-center justify-center"
                            title="升级到Max以使用此功能"
                          >
                            <Lock className="w-4 h-4" />
                          </Link>
                        )}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                          终止任务
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="group relative">
                    {hasAutoClickAccess ? (
                      <ProtectedButton
                        featureName="autoclick"
                        onClick={((: any): any) => setMonitoringTaskId(monitoringTaskId === task.id ? null : task.id)}
                        className={`p-2 rounded-lg ${
                          monitoringTaskId === task.id 
                            ? 'text-blue-600 bg-blue-100' 
                            : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        <BarChart3 className="w-4 h-4" />
                      </ProtectedButton>
                    ) : (
                      <Link
                        href="/pricing"
                        className={`p-2 rounded-lg ${
                          monitoringTaskId === task.id 
                            ? 'text-blue-600 bg-blue-100' 
                            : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                        } flex items-center justify-center`}
                        title="升级到Max以使用此功能"
                      >
                        <Lock className="w-4 h-4" />
                      </Link>
                    )}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                      查看实时进度
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 实时进度监控 */}
              {monitoringTaskId === task.id && (
                <div className="mt-4 border-t pt-4">
                  <AutoClickProgressMonitor taskId={task.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 功能说明 */}
      <div className={`${UI_CONSTANTS.cards.simple} p-6`}>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          {t("batchOpenSection.autoclickVersion.title")}
        </h4>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>• <strong>智能调度：</strong>系统根据时间权重自动分配24小时点击量，高峰时段增加点击频率</li>
          <li>• <strong>自动执行：</strong>无需人工干预，系统每小时自动执行点击任务</li>
          <li>• <strong>双引擎：</strong>集成SimpleHttp和Puppeteer两种访问器，失败时自动切换</li>
          <li>• <strong>代理轮换：</strong>每次访问使用新的代理IP，确保访问真实性</li>
          <li>• <strong>Token计费：</strong>按实际成功点击次数消耗Token，失败不扣费</li>
          <li>• <strong>实时监控：</strong>可查看任务执行状态和今日进度</li>
        </ul>
      </div>
    </div>
  );
}