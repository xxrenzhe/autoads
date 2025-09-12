'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Clock, 
  Calendar,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { TrackingConfiguration, ScheduleConfig } from '../types';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createClientLogger('SchedulingManager');

interface SchedulingManagerProps {
  configurations: TrackingConfiguration[];
  scheduledTasks: unknown[];
  orchestrator: unknown;
  onCreateScheduledTask: (configuration: TrackingConfiguration, schedule: ScheduleConfig) => Promise<void>;
  onDeleteScheduledTask: (taskId: string) => Promise<void>;
  onExecuteScheduledTask: (taskId: string) => Promise<void>;
}

const SchedulingManager: React.FC<SchedulingManagerProps> = ({
  configurations,
  scheduledTasks,
  orchestrator,
  onCreateScheduledTask,
  onDeleteScheduledTask,
  onExecuteScheduledTask
}) => {
  const [selectedConfiguration, setSelectedConfiguration] = useState<TrackingConfiguration | null>(null);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    type: 'DAILY',
    time: '09:00',
    timezone: 'UTC'
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTask = useCallback(async () => {
    if (!selectedConfiguration) return;

    setIsCreating(true);
    try {
      await onCreateScheduledTask(selectedConfiguration, scheduleConfig);
      setSelectedConfiguration(null);
      setScheduleConfig({
        type: 'DAILY',
        time: '09:00',
        timezone: 'UTC'
      });
    } catch (error) {
      logger.error('Failed to create scheduled task:', new EnhancedError('Failed to create scheduled task:', { error: error instanceof Error ? error.message : String(error)  }));
    } finally {
      setIsCreating(false);
    }
  }, [selectedConfiguration, scheduleConfig, onCreateScheduledTask]);
  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (confirm('Are you sure you want to delete this scheduled task?')) {
      try {
        await onDeleteScheduledTask(taskId);
      } catch (error) {
        logger.error('Failed to delete scheduled task:', new EnhancedError('Failed to delete scheduled task:', { error: error instanceof Error ? error.message : String(error)  }));
      }
    }
  }, [onDeleteScheduledTask]);
  const handleExecuteTask = useCallback(async (taskId: string) => {
    try {
      await onExecuteScheduledTask(taskId);
    } catch (error) {
      logger.error('Failed to execute scheduled task:', new EnhancedError('Failed to execute scheduled task:', { error: error instanceof Error ? error.message : String(error)  }));
    }
  }, [onExecuteScheduledTask]);
  const getNextRunTime = useCallback((task: unknown) => {
    const t = task as any;
    if (!t.nextRun) return 'Not scheduled';
    return new Date(t.nextRun).toLocaleString();
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-500';
      case 'running':
        return 'bg-green-500';
      case 'completed':
        return 'bg-gray-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Scheduling Manager</h2>
          <p className="text-gray-600">Manage scheduled tasks and automation</p>
        </div>
        <Button
          onClick={() => setSelectedConfiguration(configurations[0] || null)}
          disabled={configurations.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Scheduled Task
        </Button>
      </div>

      {/* Create New Task */}
      {selectedConfiguration && (
        <Card>
          <CardHeader>
            <CardTitle>Create Scheduled Task</CardTitle>
            <CardDescription>
              Configure automated execution for: {selectedConfiguration.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="frequency">Frequency</Label>
                <select
                  id="frequency"
                  value={scheduleConfig.type}
                  onChange={(e) => setScheduleConfig(prev => ({
                    ...prev,
                    type: e.target.value as 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'
                  }))}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="ONCE">Once</option>
                </select>
              </div>
              
              <div>
                <Label htmlFor="time">Execution Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={scheduleConfig.time}
                  onChange={(e) => setScheduleConfig(prev => ({
                    ...prev,
                    time: e.target.value
                  }))}
                />
              </div>
              
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  value={scheduleConfig.timezone}
                  onChange={(e) => setScheduleConfig(prev => ({
                    ...prev,
                    timezone: e.target.value
                  }))}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 mt-4">
              <Button
                onClick={handleCreateTask}
                disabled={isCreating}
              >
                <Calendar className="h-4 w-4 mr-2" />
                {isCreating ? 'Creating...' : 'Create Task'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedConfiguration(null)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scheduled Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Scheduled Tasks</span>
            <Badge variant="outline">{scheduledTasks.length}</Badge>
          </CardTitle>
          <CardDescription>
            Manage your automated execution schedules
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scheduledTasks.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Scheduled Tasks</h3>
              <p className="text-gray-500">Create your first scheduled task to automate executions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {scheduledTasks.map((task, idx: number) => {
                const t = task as any;
                return (
                  <div
                    key={t.id || idx}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${getStatusColor(t.status)}`}>
                          <Clock className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{t.name}</h4>
                          <p className="text-sm text-gray-500">
                            Configuration: {t.configurationName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={t.status === 'scheduled' ? 'default' : 'secondary'}>
                          {t.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-500">Frequency:</span>
                        <span className="ml-2 text-gray-900 capitalize">{t.schedule.frequency}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Time:</span>
                        <span className="ml-2 text-gray-900">{t.schedule.time}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Next Run:</span>
                        <span className="ml-2 text-gray-900">{getNextRunTime(t)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Run Count:</span>
                        <span className="ml-2 text-gray-900">{t.runCount}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExecuteTask(t.id)}
                        disabled={t.status === 'running'}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Execute Now
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteTask(t.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common scheduling operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center"
              onClick={() => {
                // Enable all scheduled tasks
                logger.info('Enable all tasks');
              }}
            >
              <CheckCircle className="h-6 w-6 mb-2" />
              <span>Enable All Tasks</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center"
              onClick={() => {
                // Disable all scheduled tasks
                logger.info('Disable all tasks');
              }}
            >
              <XCircle className="h-6 w-6 mb-2" />
              <span>Disable All Tasks</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center"
              onClick={() => {
                // View scheduling logs
                logger.info('View logs');
              }}
            >
              <Settings className="h-6 w-6 mb-2" />
              <span>View Logs</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchedulingManager;