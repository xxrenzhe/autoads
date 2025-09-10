/**
 * 简化的执行仓库 - 用于构建过程
 */

export interface CreateExecutionInput {
  configuration_id: string;
  user_id: string;
  total_items: number;
}

export interface Execution {
  id: string;
  configuration_id: string;
  user_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  total_items: number;
  processed_items: number;
  results: unknown;
  error_log: unknown;
  started_at: Date;
  completed_at?: Date;
  created_at: Date;
}

export class ExecutionRepository {
  constructor() {
    // 简化构造函数用于构建
  }

  async create(execution: CreateExecutionInput): Promise<Execution> {
    // 简化实现用于构建
    return {
      id: `exec_${Date.now()}`,
      configuration_id: execution.configuration_id,
      user_id: execution.user_id,
      status: 'pending',
      progress: 0,
      total_items: execution.total_items,
      processed_items: 0,
      results: null,
      error_log: null,
      started_at: new Date(),
      created_at: new Date()
    };
  }

  async update(id: string, updates: Partial<Execution>): Promise<Execution> {
    // 简化实现用于构建
    return {
      id,
      configuration_id: '',
      user_id: '',
      status: 'pending',
      progress: 0,
      total_items: 0,
      processed_items: 0,
      results: null,
      error_log: null,
      started_at: new Date(),
      created_at: new Date(),
      ...updates
    };
  }

  async findById(id: string): Promise<Execution | null> {
    // 简化实现用于构建
    return null as any;
  }
}