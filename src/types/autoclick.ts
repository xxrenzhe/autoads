// import { AutoClickTask, DailyExecutionPlan, HourlyExecution, DailySummary } from '@prisma/client'; // TODO: Implement these models

export type AutoClickTaskStatus = 'pending' | 'running' | 'terminated';

export interface AutoClickTask {
  id: string;
  userId: string;
  offerUrl: string;
  country: string;
  timeWindow: string;
  dailyClicks: number;
  referer: string;
  status: AutoClickTaskStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyExecutionPlan {
  id: string;
  taskId: string;
  date: Date;
  totalClicks: number;
  hourlyDistribution: number[];
  status: string;
  createdAt: Date;
}

export interface HourlyExecution {
  id: string;
  planId: string;
  hour: number;
  targetClicks: number;
  actualClicks: number;
  successCount: number;
  failCount: number;
  executionDetails?: any;
  createdAt: Date;
}

export interface DailySummary {
  id: string;
  taskId: string;
  date: Date;
  totalClicks: number;
  successCount: number;
  failCount: number;
  tokensUsed: number;
  executionStatus: string;
  createdAt: Date;
}

export interface AutoClickTaskWithDetails extends AutoClickTask {
  dailyPlans?: DailyExecutionPlan[];
  _count?: {
    dailyPlans: number;
  };
}

export interface CreateAutoClickTaskInput {
  offerUrl: string;
  country?: string;
  timeWindow: string;
  dailyClicks: number;
  referer: string;
}

export interface UpdateAutoClickTaskInput extends Partial<CreateAutoClickTaskInput> {
  status?: AutoClickTaskStatus;
}

export interface DailyExecutionStats {
  date: string;
  totalClicks: number;
  successCount: number;
  failCount: number;
  tokensUsed: number;
  executionStatus: string;
}

export interface HourlyExecutionDetail {
  hour: number;
  targetClicks: number;
  actualClicks: number;
  successCount: number;
  failCount: number;
  tokensUsed: number;
  executionDetails?: any;
}

export interface TaskProgress {
  taskId: string;
  todayProgress: {
    totalTarget: number;
    completed: number;
    percentage: number;
  };
  currentHour: number;
  hourlyProgress: HourlyExecutionDetail[];
  status: AutoClickTaskStatus;
  lastExecution?: Date;
}

export interface AutoClickTaskFilters {
  status?: AutoClickTaskStatus;
  country?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

export interface AutoClickTasksResponse {
  tasks: AutoClickTaskWithDetails[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}