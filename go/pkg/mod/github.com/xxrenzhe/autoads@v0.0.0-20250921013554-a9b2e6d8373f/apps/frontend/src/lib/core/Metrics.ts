import { createLogger } from "@/lib/utils/security/secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createLogger('Metrics');

export interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface MetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  description?: string;
  labels?: string[];
  buckets?: number[];
  quantiles?: number[];
}

export interface MetricData {
  definition: MetricDefinition;
  values: MetricValue[];
  lastValue?: number;
  sum?: number;
  count?: number;
  min?: number;
  max?: number;
  mean?: number;
}

export interface MetricsConfig {
  service: string;
  enableAggregation?: boolean;
  aggregationWindow?: number;
  maxDataPoints?: number;
  enableExport?: boolean;
  exportInterval?: number;
}

export class Metrics {
  private config: MetricsConfig;
  private metrics = new Map<string, MetricData>();
  private aggregators = new Map<string, NodeJS.Timeout>();
  private exporters: Array<(metrics: Map<string, MetricData>) => void> = [];

  constructor(service: string, config?: Partial<MetricsConfig>) {
    this.config = {
      service,
      enableAggregation: true,
      aggregationWindow: 60000, // 1 minute
      maxDataPoints: 1000,
      enableExport: false,
      exportInterval: 300000, // 5 minutes
      ...config
    };

    if (this.config.enableExport) {
      this.startExportTimer();
    }
  }

  // Counter Metrics
  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    this.recordMetric(name, 'counter', value, labels);
  }

  decrement(name: string, value: number = 1, labels?: Record<string, string>): void {
    this.recordMetric(name, 'counter', -value, labels);
  }

  // Gauge Metrics
  gauge(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, 'gauge', value, labels);
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, 'gauge', value, labels);
  }

  // Histogram Metrics
  histogram(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, 'histogram', value, labels);
  }

  // Summary Metrics
  summary(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, 'summary', value, labels);
  }

  // Custom Metrics
  recordMetric(
    name: string,
    type: MetricDefinition['type'],
    value: number,
    labels?: Record<string, string>
  ): void {
    const metricKey = this.getMetricKey(name, labels);
    
    if (!this.metrics.has(metricKey)) {
      this.metrics.set(metricKey, {
        definition: {
          name,
          type,
          labels: labels ? Object.keys(labels) : undefined
        },
        values: []
      });
    }

    const metric = this.metrics.get(metricKey)!;
    const timestamp = Date.now();

    // Add new value
    metric.values.push({ value, timestamp, labels });
    // Update aggregations
    this.updateAggregations(metric, value);

    // Limit data points
    if (metric.values.length > this.config.maxDataPoints!) {
      metric.values.shift();
    }

    // Start aggregation timer if not already running
    if (this.config.enableAggregation && !this.aggregators.has(metricKey)) {
      this.startAggregationTimer(metricKey);
    }
  }

  // Performance Metrics
  recordSuccess(operation: string, duration: number, labels?: Record<string, string>): void {
    this.increment(`${operation}_success`, 1, labels);
    this.histogram(`${operation}_duration`, duration, labels);
  }

  recordError(operation: string, duration: number, labels?: Record<string, string>): void {
    this.increment(`${operation}_error`, 1, labels);
    this.histogram(`${operation}_duration`, duration, labels);
  }

  recordCacheHit(key: string, labels?: Record<string, string>): void { 
      this.increment('cache_hit', 1, { key, ...labels });
  }

  recordCacheMiss(key: string, labels?: Record<string, string>): void { 
      this.increment('cache_miss', 1, { key, ...labels });
  }

  // Timer Utility
  async time<T>(name: string, operation: () => Promise<T>, labels?: Record<string, string>): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      this.recordSuccess(name, duration, labels);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordError(name, duration, labels);
      throw error;
    }
  }

  timeSync<T>(name: string, operation: () => T, labels?: Record<string, string>): T {
    const startTime = Date.now();
    
    try {
      const result = operation();
      const duration = Date.now() - startTime;
      this.recordSuccess(name, duration, labels);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordError(name, duration, labels);
      throw error;
    }
  }

  // Metric Queries
  getMetric(name: string, labels?: Record<string, string>): MetricData | undefined {
    const metricKey = this.getMetricKey(name, labels);
    return this.metrics.get(metricKey);
  }

  getMetrics(pattern?: string): Map<string, MetricData> {
    if (!pattern) {
      return new Map(this.metrics);
    }

    const filtered = new Map<string, MetricData>();
    const regex = new RegExp(pattern);

    for (const [key, metric] of this.metrics.entries()) {
      if (regex.test(metric.definition.name)) {
        filtered.set(key, metric);
      }
    }

    return filtered;
  }

  getMetricValue(name: string, labels?: Record<string, string>): number | undefined {
    const metric = this.getMetric(name, labels);
    return metric?.lastValue;
  }

  getMetricStats(name: string, labels?: Record<string, string>): {
    count: number;
    sum: number;
    min: number;
    max: number;
    mean: number;
  } | undefined {
    const metric = this.getMetric(name, labels);
    if (!metric) return undefined;

    return {
      count: metric.count || 0,
      sum: metric.sum || 0,
      min: metric.min || 0,
      max: metric.max || 0,
      mean: metric.mean || 0
    };
  }

  // Aggregation
  private updateAggregations(metric: MetricData, value: number): void {
    metric.lastValue = value;
    metric.sum = (metric.sum || 0) + value;
    metric.count = (metric.count || 0) + 1;
    metric.min = metric.min === undefined ? value : Math.min(metric.min, value);
    metric.max = metric.max === undefined ? value : Math.max(metric.max, value);
    metric.mean = metric.sum / metric.count;
  }

  private startAggregationTimer(metricKey: string): void {
    const timer = setInterval(() => {
      this.aggregateMetric(metricKey);
    }, this.config.aggregationWindow);

    this.aggregators.set(metricKey, timer);
  }

  private aggregateMetric(metricKey: string): void {
    const metric = this.metrics.get(metricKey);
    if (!metric) return;

    // Create aggregated metric
    const aggregatedName = `${metric.definition.name}_aggregated`;
    const aggregatedLabels = metric.values[0]?.labels;

    this.gauge(aggregatedName, metric.mean || 0, aggregatedLabels);
    this.gauge(`${aggregatedName}_count`, metric.count || 0, aggregatedLabels);
    this.gauge(`${aggregatedName}_min`, metric.min || 0, aggregatedLabels);
    this.gauge(`${aggregatedName}_max`, metric.max || 0, aggregatedLabels);
  }

  // Export
  addExporter(exporter: (metrics: Map<string, MetricData>) => void): void {
    this.exporters.push(exporter);
  }

  private startExportTimer(): void {
    setInterval(() => {
      this.exportMetrics();
    }, this.config.exportInterval);
  }

  private exportMetrics(): void {
    for (const exporter of this.exporters) {
      try {
        exporter(new Map(this.metrics));
      } catch (error) { 
          logger.error('Metrics export failed:', new EnhancedError('Metrics export failed:', { error: error instanceof Error ? error.message : String(error)  }));
      }
    }
  }

  // Utility Methods
  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels) {
      return name;
    }

    const labelString = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]: any) => `${key}=${value}`)
      .join(',');

    return `${name}{${labelString}}`;
  }

  // Cleanup
  clear(): void {
    this.metrics.clear();
    
    for (const timer of this.aggregators.values()) {
      clearInterval(timer);
    }
    this.aggregators.clear();
  }

  stop(): void {
    for (const timer of this.aggregators.values()) {
      clearInterval(timer);
    }
    this.aggregators.clear();
  }

  // Health Check
  healthCheck(): { status: 'healthy' | 'unhealthy'; details: unknown } {
    try {
      const totalMetrics = this.metrics.size;
      const totalDataPoints = Array.from(this.metrics.values())
        .reduce((sum, metric: any) => sum + metric.values.length, 0);

      return {
        status: 'healthy',
        details: {
          totalMetrics,
          totalDataPoints,
          aggregators: this.aggregators.size,
          exporters: this.exporters.length
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  // Prometheus Format Export
  toPrometheusFormat(): string {
    const lines: string[] = [];
    
    for (const [key, metric] of this.metrics.entries()) {
      const { name, type } = metric.definition;
      const value = metric.lastValue || 0;
      
      // Add metric type comment
      lines.push(`# TYPE ${name} ${type}`);
      
      // Add metric value
      if (metric.values[0]?.labels) {
        const labels = Object.entries(metric.values[0].labels)
          .map(([k, v]: any) => `${k}="${v}"`)
          .join(',');
        lines.push(`${name}{${labels}} ${value}`);
      } else {
        lines.push(`${name} ${value}`);
      }
    }
    
    return lines.join('\n');
  }

  // JSON Format Export
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      service: this.config.service,
      timestamp: Date.now(),
      metrics: {}
    };

    const metricsObj = result.metrics as Record<string, unknown>;
    for (const [key, metric] of this.metrics.entries()) {
      metricsObj[key] = {
        definition: metric.definition,
        lastValue: metric.lastValue,
        sum: metric.sum,
        count: metric.count,
        min: metric.min,
        max: metric.max,
        mean: metric.mean,
        dataPoints: metric.values.length
      };
    }

    return result;
  }
} 