"use client";

import React from 'react';
import { clsx } from 'clsx';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ExclamationTriangleIcon,
  ClockIcon,
  InformationCircleIcon,
  PlayIcon,
  PauseIcon
} from '@heroicons/react/24/outline';

export type StatusType = 
  | 'success' 
  | 'error' 
  | 'warning' 
  | 'info' 
  | 'pending' 
  | 'running' 
  | 'paused' 
  | 'idle'
  | 'completed'
  | 'failed'
  | 'processing'
  | string; // Allow any string for flexibility

export interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dot' | 'badge' | 'icon';
  animated?: boolean;
  className?: string;
}

const statusConfig = {
  success: {
    color: 'text-green-600',
    backgroundColor: 'bg-green-100',
    borderColor: 'border-green-200',
    dotColor: 'bg-green-500',
    icon: CheckCircleIcon,
    label: 'Success'
  },
  error: {
    color: 'text-red-600',
    backgroundColor: 'bg-red-100',
    borderColor: 'border-red-200',
    dotColor: 'bg-red-500',
    icon: XCircleIcon,
    label: 'Error'
  },
  warning: {
    color: 'text-yellow-600',
    backgroundColor: 'bg-yellow-100',
    borderColor: 'border-yellow-200',
    dotColor: 'bg-yellow-500',
    icon: ExclamationTriangleIcon,
    label: 'Warning'
  },
  info: {
    color: 'text-blue-600',
    backgroundColor: 'bg-blue-100',
    borderColor: 'border-blue-200',
    dotColor: 'bg-blue-500',
    icon: InformationCircleIcon,
    label: 'Info'
  },
  pending: {
    color: 'text-gray-600',
    backgroundColor: 'bg-gray-100',
    borderColor: 'border-gray-200',
    dotColor: 'bg-gray-500',
    icon: ClockIcon,
    label: 'Pending'
  },
  running: {
    color: 'text-green-600',
    backgroundColor: 'bg-green-100',
    borderColor: 'border-green-200',
    dotColor: 'bg-green-500',
    icon: PlayIcon,
    label: 'Running'
  },
  paused: {
    color: 'text-orange-600',
    backgroundColor: 'bg-orange-100',
    borderColor: 'border-orange-200',
    dotColor: 'bg-orange-500',
    icon: PauseIcon,
    label: 'Paused'
  },
  idle: {
    color: 'text-gray-500',
    backgroundColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    dotColor: 'bg-gray-400',
    icon: ClockIcon,
    label: 'Idle'
  }
};

const sizeConfig = {
  sm: {
    dot: 'w-2 h-2',
    icon: 'w-4 h-4',
    text: 'text-xs',
    padding: 'px-2 py-1'
  },
  md: {
    dot: 'w-3 h-3',
    icon: 'w-5 h-5',
    text: 'text-sm',
    padding: 'px-3 py-1.5'
  },
  lg: {
    dot: 'w-4 h-4',
    icon: 'w-6 h-6',
    text: 'text-base',
    padding: 'px-4 py-2'
  }
};

export function StatusIndicator({
  status,
  label,
  size = 'md',
  variant = 'badge',
  animated = false,
  className
}: .*Props) {
  // Map common status strings to our defined types
  const normalizedStatus = (() => {
    if (status in statusConfig) return status as keyof typeof statusConfig;
    if (status === 'completed') return 'success';
    if (status === 'failed') return 'error';
    if (status === 'processing') return 'running';
    return 'info'; // Default fallback
  })();
  
  const config = statusConfig[normalizedStatus];
  const sizeClasses = sizeConfig[size];
  const displayLabel = label || config.label;
  const Icon = config.icon;

  if (variant === 'dot') => {
    return (
      <div className={clsx("flex items-center space-x-2", className)}>
        <div
          className={clsx(
            "rounded-full",
            sizeClasses.dot,
            config.dotColor,
            animated && (status === 'running' || status === 'pending') && "animate-pulse"
          )}
        />
        {displayLabel && (
          <span className={clsx(sizeClasses.text, "text-gray-700")}>
            {displayLabel}
          </span>
        )}
      </div>
    );
  }

  if (variant === 'icon') => {
    return (
      <div className={clsx("flex items-center space-x-2", className)}>
        <Icon
          className={clsx(
            sizeClasses.icon,
            config.color,
            animated && (status === 'running' || status === 'pending') && "animate-spin"
          )}
        />
        {displayLabel && (
          <span className={clsx(sizeClasses.text, config.color)}>
            {displayLabel}
          </span>
        )}
      </div>
    );
  }

  // Badge variant (default)
  return (
    <div
      className={clsx(
        "inline-flex items-center space-x-1.5 rounded-full border",
        sizeClasses.padding,
        sizeClasses.text,
        config.backgroundColor,
        config.color,
        config.borderColor,
        className
      )}
    >
      <div
        className={clsx(
          "rounded-full",
          sizeClasses.dot,
          config.dotColor,
          animated && (status === 'running' || status === 'pending') && "animate-pulse"
        )}
      />
      <span className="font-medium">{displayLabel}</span>
    </div>
  );
}

// Batch Status Indicator for showing multiple statuses
export interface BatchStatusIndicatorProps {
  statuses: { status: StatusType; count: number; label?: string }[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function BatchStatusIndicator({
  statuses,
  size = 'md',
  className
}: .*Props) {
  const total = statuses.reduce((sum, item: any) => sum + item.count, 0);

  return (
    <div className={clsx("flex flex-wrap gap-2", className)}>
      {statuses.map((item, index: any) => (
        <StatusIndicator
          key={index}
          status={item.status}
          label={`${item.label || statusConfig[item.status as keyof typeof statusConfig].label} (${item.count})`}
          size={size}
          variant="badge"
        />
      ))}
      <div className={clsx(
        "inline-flex items-center rounded-full border border-gray-200 bg-gray-50",
        sizeConfig[size].padding,
        sizeConfig[size].text
      )}>
        <span className="font-medium text-gray-600">Total: {total}</span>
      </div>
    </div>
  );
}