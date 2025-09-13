'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PerformanceData {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  responseTime: {
    avg: number;
    p95: number;
    p99: number;
  };
  cache: {
    hitRate: number;
    size: number;
  };
  requests: {
    total: number;
    errorRate: number;
  };
}

export const PerformanceDashboard: React.FC = () => {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/admin/performance');
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Failed to fetch performance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) => {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!data) => {
    return (
      <div className="text-center text-gray-500">
        Failed to load performance data
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Performance Dashboard</h2>
      
      {/* Memory Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Memory Usage
            <Badge variant={data.memory.percentage > 80 ? 'destructive' : 'secondary'}>
              {Math.round(data.memory.percentage * 100)}%
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Used: {formatBytes(data.memory.used)}</span>
              <span>Total: {formatBytes(data.memory.total)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getStatusColor(data.memory.percentage * 100)}`}
                style={{ width: `${data.memory.percentage * 100}%` }}
              ></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Response Time */}
      <Card>
        <CardHeader>
          <CardTitle>Response Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{data.responseTime.avg.toFixed(0)}ms</div>
              <div className="text-sm text-gray-500">Average</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{data.responseTime.p95.toFixed(0)}ms</div>
              <div className="text-sm text-gray-500">95th Percentile</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{data.responseTime.p99.toFixed(0)}ms</div>
              <div className="text-sm text-gray-500">99th Percentile</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cache Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Cache Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{(data.cache.hitRate * 100).toFixed(1)}%</div>
              <div className="text-sm text-gray-500">Hit Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{formatBytes(data.cache.size)}</div>
              <div className="text-sm text-gray-500">Cache Size</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Request Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Request Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{data.requests.total.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Total Requests</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{(data.requests.errorRate * 100).toFixed(2)}%</div>
              <div className="text-sm text-gray-500">Error Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
