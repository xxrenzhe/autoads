/**
 * Progress tracking types
 */

export interface ProgressData {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'terminated';
  progress: number;
  completed: number;
  failed: number;
  total: number;
  message?: string;
  timestamp: number;
}