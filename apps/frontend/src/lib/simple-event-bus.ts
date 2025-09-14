import { EventEmitter } from 'events';

// 简单的事件总线，替换复杂的EventBus实现
export const eventBus = new EventEmitter();

// 事件类型定义
export const EventTypes = {
  // API相关事件
  API_CALL: 'apiCall',
  API_ERROR: 'apiError',
  
  // 业务功能事件
  SITERANK_USAGE: 'siterankUsage',
  BATCHOPEN_USAGE: 'batchopenUsage',
  ADSCENTER_USAGE: 'adscenterUsage',
  
  // Token消耗事件
  TOKEN_CONSUMED: 'tokenConsumed',
  
  // 用户事件
  USER_LOGIN: 'userLogin',
  USER_SIGNUP: 'userSignup'
} as const;

// 事件数据接口
export interface ApiCallEvent {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  userId?: string;
  feature?: 'siterank' | 'batchopen' | 'adscenter';
}

export interface TokenConsumedEvent {
  userId: string;
  amount: number;
  feature: 'siterank' | 'batchopen' | 'adscenter';
  endpoint: string;
}

export interface FeatureUsageEvent {
  userId: string;
  feature: 'siterank' | 'batchopen' | 'adscenter';
  endpoint: string;
}

// 便捷方法
export const emitApiCall = (data: ApiCallEvent) => {
  eventBus.emit(EventTypes.API_CALL, data);
};

export const emitTokenConsumed = (data: TokenConsumedEvent) => {
  eventBus.emit(EventTypes.TOKEN_CONSUMED, data);
};

export const emitFeatureUsage = (data: FeatureUsageEvent) => {
  const eventType = EventTypes[`${data.feature.toUpperCase()}_USAGE` as keyof typeof EventTypes];
  eventBus.emit(eventType, data);
};

export default eventBus;
