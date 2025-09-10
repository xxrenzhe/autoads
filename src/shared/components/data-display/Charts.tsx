"use client";

import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { clsx } from 'clsx';

// Common chart props
interface BaseChartProps {
  data: any[];
  width?: number;
  height?: number;
  className?: string;
  loading?: boolean;
}

// Line Chart Component
export interface LineChartProps extends BaseChartProps {
  xKey: string;
  yKey: string;
  lineColor?: string;
  strokeWidth?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
}

export function CustomLineChart({
  data,
  xKey,
  yKey,
  lineColor = '#2563eb',
  strokeWidth = 2,
  showGrid = true,
  showTooltip = true,
  showLegend = false,
  height = 300,
  className,
  loading = false
}: LineChartProps) {
  if (loading) {
    return (
      <div className={clsx("flex items-center justify-center", className)} style={{ height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={clsx("w-full", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis dataKey={xKey} />
          <YAxis />
          {showTooltip && <Tooltip />}
          {showLegend && <Legend />}
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={lineColor}
            strokeWidth={strokeWidth}
            dot={{ fill: lineColor, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Area Chart Component
export interface AreaChartProps extends BaseChartProps {
  xKey: string;
  yKey: string;
  fillColor?: string;
  strokeColor?: string;
  showGrid?: boolean;
  showTooltip?: boolean;
}

export function CustomAreaChart({
  data,
  xKey,
  yKey,
  fillColor = '#3b82f6',
  strokeColor = '#2563eb',
  showGrid = true,
  showTooltip = true,
  height = 300,
  className,
  loading = false
}: AreaChartProps) {
  if (loading) {
    return (
      <div className={clsx("flex items-center justify-center", className)} style={{ height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={clsx("w-full", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis dataKey={xKey} />
          <YAxis />
          {showTooltip && <Tooltip />}
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={strokeColor}
            fill={fillColor}
            fillOpacity={0.6}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Bar Chart Component
export interface BarChartProps extends BaseChartProps {
  xKey: string;
  yKey: string;
  barColor?: string;
  showGrid?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
  orientation?: 'vertical' | 'horizontal';
}

export function CustomBarChart({
  data,
  xKey,
  yKey,
  barColor = '#3b82f6',
  showGrid = true,
  showTooltip = true,
  showLegend = false,
  orientation = 'vertical',
  height = 300,
  className,
  loading = false
}: BarChartProps) {
  if (loading) {
    return (
      <div className={clsx("flex items-center justify-center", className)} style={{ height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={clsx("w-full", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          layout={orientation === 'horizontal' ? 'horizontal' : 'vertical'}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis dataKey={orientation === 'horizontal' ? yKey : xKey} />
          <YAxis dataKey={orientation === 'horizontal' ? xKey : yKey} />
          {showTooltip && <Tooltip />}
          {showLegend && <Legend />}
          <Bar dataKey={yKey} fill={barColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Pie Chart Component
export interface PieChartProps extends BaseChartProps {
  dataKey: string;
  nameKey: string;
  colors?: string[];
  showTooltip?: boolean;
  showLegend?: boolean;
  innerRadius?: number;
  outerRadius?: number;
}

const DEFAULT_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6b7280'
];

export function CustomPieChart({
  data,
  dataKey,
  nameKey,
  colors = DEFAULT_COLORS,
  showTooltip = true,
  showLegend = true,
  innerRadius = 0,
  outerRadius = 80,
  height = 300,
  className,
  loading = false
}: PieChartProps) {
  if (loading) {
    return (
      <div className={clsx("flex items-center justify-center", className)} style={{ height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={clsx("w-full", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey={dataKey}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          {showTooltip && <Tooltip />}
          {showLegend && <Legend />}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Multi-series Line Chart
export interface MultiLineChartProps extends BaseChartProps {
  xKey: string;
  series: Array<{
    key: string;
    name: string;
    color: string;
  }>;
  showGrid?: boolean;
  showTooltip?: boolean;
  showLegend?: boolean;
}

export function MultiLineChart({
  data,
  xKey,
  series,
  showGrid = true,
  showTooltip = true,
  showLegend = true,
  height = 300,
  className,
  loading = false
}: MultiLineChartProps) {
  if (loading) {
    return (
      <div className={clsx("flex items-center justify-center", className)} style={{ height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={clsx("w-full", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis dataKey={xKey} />
          <YAxis />
          {showTooltip && <Tooltip />}
          {showLegend && <Legend />}
          {series.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              strokeWidth={2}
              dot={{ fill: line.color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              name={line.name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Chart Container with Title and Description
export interface ChartContainerProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export function ChartContainer({
  title,
  description,
  children,
  className,
  actions
}: ChartContainerProps) {
  return (
    <div className={clsx("bg-white rounded-lg border border-gray-200 p-6", className)}>
      {(title || description || actions) && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              )}
              {description && (
                <p className="text-sm text-gray-600 mt-1">{description}</p>
              )}
            </div>
            {actions && <div className="flex items-center space-x-2">{actions}</div>}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}