'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Pause, 
  Square, 
  Eye, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  Activity
} from 'lucide-react';

interface StatusMonitoringDashboardProps {
  activeExecutions: unknown[];
  onStopExecution: (executionId: string) => Promise<void>;
  onPauseExecution: (executionId: string) => Promise<void>;
  onResumeExecution: (executionId: string) => Promise<void>;
  onNavigateToDetails: (executionId: string) => void;
  executionProgress: {[key: string]: number};
}

const StatusMonitoringDashboard: React.FC<StatusMonitoringDashboardProps> = ({
  activeExecutions,
  onStopExecution,
  onPauseExecution,
  onResumeExecution,
  onNavigateToDetails,
  executionProgress
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Simulate refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) => {
      case 'running':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      case 'completed':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  }, []);

  const getStatusIcon = useCallback((status: string) => {
    switch (status) => {
      case 'running':
        return <Activity className="h-4 w-4" />;
      case 'paused':
        return <Pause className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  }, []);

  const calculateSystemMetrics = useCallback(() => {
    const total = activeExecutions.length;
    const running = activeExecutions.filter((exec: any) => (exec as any).status === 'running').length;
    const paused = activeExecutions.filter((exec: any) => (exec as any).status === 'paused').length;
    const failed = activeExecutions.filter((exec: any) => (exec as any).status === 'failed').length;
    const completed = activeExecutions.filter((exec: any) => (exec as any).status === 'completed').length;

    return {
      total,
      running,
      paused,
      failed,
      completed,
      successRate: total > 0 ? ((completed + running) / total) * 100 : 0
    };
  }, [activeExecutions]);
  const metrics = calculateSystemMetrics();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Status Monitoring Dashboard</h2>
          <p className="text-gray-600">Real-time monitoring of execution status and system performance</p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Executions</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.total}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Running</p>
                <p className="text-2xl font-bold text-green-600">{metrics.running}</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <Play className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-blue-600">{metrics.successRate.toFixed(1)}%</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">{metrics.failed}</p>
              </div>
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Executions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Active Executions</span>
            <Badge variant="outline">{activeExecutions.length}</Badge>
          </CardTitle>
          <CardDescription>
            Monitor real-time execution status and progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeExecutions.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Executions</h3>
              <p className="text-gray-500">All executions are currently idle</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeExecutions.map((execution, idx: any) => {
                const exec = execution as any;
                const progress = executionProgress[exec.executionId] || 0;
                
                return (
                  <div
                    key={exec.executionId || idx}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${getStatusColor(exec.status)}`}>
                          {getStatusIcon(exec.status)}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {exec.configurationName || 'Unnamed Configuration'}
                          </h4>
                          <p className="text-sm text-gray-500">
                            Execution ID: {exec.executionId}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={exec.status === 'running' ? 'default' : 'secondary'}>
                          {exec.status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onNavigateToDetails(exec.executionId)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>Progress</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Started:</span>
                          <span className="ml-2 text-gray-900">
                            {new Date(exec.startTime).toLocaleTimeString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Phase:</span>
                          <span className="ml-2 text-gray-900 capitalize">
                            {exec.currentPhase || 'unknown'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 pt-2">
                                                 {exec.status === 'running' && (
                           <>
                             <Button
                               size="sm"
                               variant="outline"
                               onClick={() => onPauseExecution(exec.executionId)}
                             >
                               <Pause className="h-4 w-4 mr-1" />
                               Pause
                             </Button>
                             <Button
                               size="sm"
                               variant="destructive"
                               onClick={() => onStopExecution(exec.executionId)}
                             >
                               <Square className="h-4 w-4 mr-1" />
                               Stop
                             </Button>
                           </>
                         )}
                                                 {exec.status === 'paused' && (
                           <>
                             <Button
                               size="sm"
                               onClick={() => onResumeExecution(exec.executionId)}
                             >
                               <Play className="h-4 w-4 mr-1" />
                               Resume
                             </Button>
                             <Button
                               size="sm"
                               variant="destructive"
                               onClick={() => onStopExecution(exec.executionId)}
                             >
                               <Square className="h-4 w-4 mr-1" />
                               Stop
                             </Button>
                           </>
                         )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Alerts */}
      {metrics.failed > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex justify-between items-center">
              <span>There are {metrics.failed} failed executions that require attention.</span>
              <Button variant="outline" size="sm">
                View Details
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>System performance and resource usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">98.5%</div>
              <div className="text-sm text-gray-600">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">2.3s</div>
              <div className="text-sm text-gray-600">Avg Response Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">45%</div>
              <div className="text-sm text-gray-600">CPU Usage</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatusMonitoringDashboard;