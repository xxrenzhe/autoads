/**
 * Task management types
 */

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'terminated';

export interface TaskStatusType {
  taskId: string;
  status: TaskStatus;
  progress: number;
  successCount?: number;
  failCount?: number;
  total?: number;
  message?: string;
  startTime?: number;
  endTime?: number;
}