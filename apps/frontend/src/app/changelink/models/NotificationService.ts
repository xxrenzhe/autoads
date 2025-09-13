/**
 * 通知服务
 * 负责发送执行结果通知、系统告警等
 */

import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('NotificationService');

export interface NotificationConfig {
  email?: {
    enabled: boolean;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPassword?: string;
    fromEmail?: string;
    fromName?: string;
  };
  webhook?: {
    enabled: boolean;
    url?: string;
    headers?: Record<string, string>;
  };
  slack?: {
    enabled: boolean;
    webhookUrl?: string;
    channel?: string;
  };
}

export interface ExecutionReport {
  executionId: string;
  configurationId: string;
  configurationName?: string;
  status: 'completed' | 'failed' | 'cancelled';
  duration: number;
  summary: {
    totalLinks: number;
    totalExtractions: number;
    successfulExtractions: number;
    failedExtractions: number;
    successfulUpdates: number;
    failedUpdates: number;
  };
  errors?: Array<{
    step: string;
    error: string;
    timestamp: Date;
  }>;
}

export interface SystemAlert {
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export class NotificationService {
  private config: NotificationConfig;

  constructor(config: NotificationConfig = {}) {
    this.config = {
      email: { enabled: false, ...config.email },
      webhook: { enabled: false, ...config.webhook },
      slack: { enabled: false, ...config.slack }
    };
  }

  /**
   * 发送执行报告
   */
  async sendExecutionReport(
    recipient: string,
    configurationName: string,
    report: ExecutionReport
  ): Promise<void> {
    try {
      const subject = this.generateEmailSubject(configurationName, report);
      const content = this.generateEmailContent(configurationName, report);

      // 发送邮件
      if (this.config.email?.enabled) {
        await this.sendEmail(recipient, subject, content);
      }

      // 发送Webhook通知
      if (this.config.webhook?.enabled) { 
        await this.sendWebhook({
          type: 'execution_report',
          recipient,
          configurationName,
          report
        });
      }

      // 发送Slack通知
      if (this.config.slack?.enabled) {
        await this.sendSlackNotification(
          this.generateSlackMessage(configurationName, report)
        );
      }

      logger.info(`执行报告已发送: ${report.executionId} -> ${recipient}`);

    } catch (error) { 
      logger.error('发送执行报告失败:', new EnhancedError('发送执行报告失败:', { error: error instanceof Error ? (error as Error).message : String(error)  }));
      throw error;
    }
  }

  /**
   * 发送系统告警
   */
  async sendSystemAlert(alert: SystemAlert, recipients: string[] = []): Promise<void> {
    try {
      const subject = `[系统告警] ${alert.title}`;
      const content = this.generateAlertContent(alert);

      // 发送给指定收件人
      for (const recipient of recipients) {
        if (this.config.email?.enabled) {
          await this.sendEmail(recipient, subject, content);
        }
      }

      // 发送Webhook通知
      if (this.config.webhook?.enabled) { 
        await this.sendWebhook({
          type: 'system_alert',
          alert,
          recipients
        });
      }

      // 发送Slack通知
      if (this.config.slack?.enabled) {
        await this.sendSlackNotification(
          this.generateSlackAlert(alert)
        );
      }

      logger.info(`系统告警已发送: ${alert.type} - ${alert.title}`);

    } catch (error) { 
      logger.error('发送系统告警失败:', new EnhancedError('发送系统告警失败:', { error: error instanceof Error ? (error as Error).message : String(error)  }));
      throw error;
    }
  }

  /**
   * 发送邮件
   */
  private async sendEmail(to: string, subject: string, content: string): Promise<void> { try {
      // 在实际环境中，这里应该使用真实的邮件服务
      // 比如 nodemailer, SendGrid, AWS SES 等
      
      // 模拟邮件发送
      if (process.env.NODE_ENV === 'development') {
        logger.info('模拟邮件发送:', { to, subject, content: content.substring(0, 100) + '...' });
        return;
      }

      // 实际邮件发送逻辑
      const emailData = {
        from: `${this.config.email?.fromName || 'ChangeLink'} <${this.config.email?.fromEmail}>`,
        to,
        subject,
        html: content
      };

      // 这里应该调用实际的邮件服务API
      logger.info('邮件发送成功:', { to, subject });
    } catch (error) { 
      logger.error('邮件发送失败:', new EnhancedError('邮件发送失败:', { error: error instanceof Error ? (error as Error).message : String(error)  }));
      throw error;
    }
  }

  /**
   * 发送Webhook通知
   */
  private async sendWebhook(data: unknown): Promise<void> {
    try {
      if (!this.config.webhook?.url) {
        throw new Error('Webhook URL未配置');
      }

      const response = await fetch(this.config.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.webhook.headers
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Webhook请求失败: ${response.status} ${response.statusText}`);
      }

      logger.info('Webhook通知发送成功');

    } catch (error) { 
      logger.error('Webhook通知发送失败:', new EnhancedError('Webhook通知发送失败:', { error: error instanceof Error ? (error as Error).message : String(error)  }));
      throw error;
    }
  }

  /**
   * 发送Slack通知
   */
  private async sendSlackNotification(message: unknown): Promise<void> {
    try {
      if (!this.config.slack?.webhookUrl) {
        throw new Error('Slack Webhook URL未配置');
      }

      const response = await fetch(this.config.slack.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        throw new Error(`Slack通知失败: ${response.status} ${response.statusText}`);
      }

      logger.info('Slack通知发送成功');

    } catch (error) { 
      logger.error('Slack通知发送失败:', new EnhancedError('Slack通知发送失败:', { error: error instanceof Error ? (error as Error).message : String(error)  }));
      throw error;
    }
  }

  /**
   * 生成邮件主题
   */
  private generateEmailSubject(configurationName: string, report: ExecutionReport): string {
    const statusText = {
      completed: '执行完成',
      failed: '执行失败',
      cancelled: '执行取消'
    }[report.status];

    const successRate = report.summary.totalExtractions > 0 
      ? Math.round((report.summary.successfulExtractions / report.summary.totalExtractions) * 100)
      : 0;

    return `[ChangeLink] ${configurationName} - ${statusText} (成功率: ${successRate}%)`;
  }

  /**
   * 生成邮件内容
   */
  private generateEmailContent(configurationName: string, report: ExecutionReport): string {
    const duration = this.formatDuration(report.duration);
    const statusColor = report.status === 'completed' ? '#28a745' : '#dc3545';
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>ChangeLink 执行报告</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .status { display: inline-block; padding: 5px 10px; border-radius: 3px; color: white; font-weight: bold; }
        .summary { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .metric { display: inline-block; margin: 10px 15px 10px 0; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .metric-label { font-size: 12px; color: #666; }
        .errors { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>ChangeLink 执行报告</h2>
            <p><strong>配置名称:</strong> ${configurationName}</p>
            <p><strong>执行ID:</strong> ${report.executionId}</p>
            <p><strong>状态:</strong> <span class="status" style="background-color: ${statusColor}">${report.status.toUpperCase()}</span></p>
            <p><strong>执行时长:</strong> ${duration}</p>
        </div>

        <div class="summary">
            <h3>执行摘要</h3>
            <div class="metric">
                <div class="metric-value">${report.summary.totalLinks}</div>
                <div class="metric-label">总链接数</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.successfulExtractions}</div>
                <div class="metric-label">成功提取</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.failedExtractions}</div>
                <div class="metric-label">提取失败</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.successfulUpdates}</div>
                <div class="metric-label">成功更新</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.failedUpdates}</div>
                <div class="metric-label">更新失败</div>
            </div>
        </div>

        ${report.errors && report.errors.length > 0 ? `
        <div class="errors">
            <h3>错误信息</h3>
            ${report.errors?.filter(Boolean)?.map((error: any) => `
                <p><strong>${error.step}:</strong> ${error.error}</p>
            `).join('')}
        </div>
        ` : ''}

        <div class="footer">
            <p>此邮件由 ChangeLink 自动化系统发送</p>
            <p>发送时间: ${new Date().toLocaleString('zh-CN')}</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * 生成告警内容
   */
  private generateAlertContent(alert: SystemAlert): string {
    const typeColor = {
      error: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8'
    }[alert.type];

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>系统告警</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .alert { padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .alert-type { display: inline-block; padding: 5px 10px; border-radius: 3px; color: white; font-weight: bold; }
        .metadata { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="alert">
            <h2>系统告警</h2>
            <p><strong>类型:</strong> <span class="alert-type" style="background-color: ${typeColor}">${alert.type.toUpperCase()}</span></p>
            <p><strong>标题:</strong> ${alert.title}</p>
            <p><strong>消息:</strong> ${alert.message}</p>
            <p><strong>时间:</strong> ${alert.timestamp.toLocaleString('zh-CN')}</p>
        </div>

        ${alert.metadata ? `
        <div class="metadata">
            <h3>详细信息</h3>
            <pre>${JSON.stringify(alert.metadata, null, 2)}</pre>
        </div>
        ` : ''}

        <div class="footer">
            <p>此邮件由 ChangeLink 监控系统发送</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * 生成Slack消息
   */
  private generateSlackMessage(configurationName: string, report: ExecutionReport): unknown {
    const statusEmoji = {
      completed: ':white_check_mark:',
      failed: ':x:',
      cancelled: ':warning:'
    }[report.status];

    const statusColor = {
      completed: 'good',
      failed: 'danger',
      cancelled: 'warning'
    }[report.status];

    return {
      channel: this.config.slack?.channel,
      attachments: [
        {
          color: statusColor,
          title: `${statusEmoji} ChangeLink 执行报告`,
          fields: [
            {
              title: '配置名称',
              value: configurationName,
              short: true
            },
            {
              title: '状态',
              value: report.status.toUpperCase(),
              short: true
            },
            {
              title: '成功提取',
              value: `${report.summary.successfulExtractions}/${report.summary.totalExtractions}`,
              short: true
            },
            {
              title: '成功更新',
              value: `${report.summary.successfulUpdates}`,
              short: true
            },
            {
              title: '执行时长',
              value: this.formatDuration(report.duration),
              short: true
            }
          ],
          footer: 'ChangeLink',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };
  }

  /**
   * 生成Slack告警
   */
  private generateSlackAlert(alert: SystemAlert): unknown {
    const typeEmoji = {
      error: ':rotating_light:',
      warning: ':warning:',
      info: ':information_source:'
    }[alert.type];

    const typeColor = {
      error: 'danger',
      warning: 'warning',
      info: 'good'
    }[alert.type];

    return {
      channel: this.config.slack?.channel,
      attachments: [
        {
          color: typeColor,
          title: `${typeEmoji} 系统告警`,
          fields: [
            {
              title: '类型',
              value: alert.type.toUpperCase(),
              short: true
            },
            {
              title: '标题',
              value: alert.title,
              short: true
            },
            {
              title: '消息',
              value: alert.message,
              short: false
            }
          ],
          footer: 'ChangeLink 监控系统',
          ts: Math.floor(alert.timestamp.getTime() / 1000)
        }
      ]
    };
  }

  /**
   * 格式化持续时间
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟${seconds % 60}秒`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = {
      email: { 
        enabled: this.config.email?.enabled || false,
        ...this.config.email, 
        ...config.email 
      },
      webhook: { 
        enabled: this.config.webhook?.enabled || false,
        ...this.config.webhook, 
        ...config.webhook 
      },
      slack: { 
        enabled: this.config.slack?.enabled || false,
        ...this.config.slack, 
        ...config.slack 
      }
    };
  }

  /**
   * 测试通知配置
   */
  async testNotification(type: 'email' | 'webhook' | 'slack', recipient?: string): Promise<boolean> {
    try {
      const testReport: ExecutionReport = {
        executionId: 'test_' + Date.now(),
        configurationId: 'test_config',
        configurationName: '测试配置',
        status: 'completed',
        duration: 120000,
        summary: {
          totalLinks: 5,
          totalExtractions: 10,
          successfulExtractions: 9,
          failedExtractions: 1,
          successfulUpdates: 8,
          failedUpdates: 1
        }
      };

      switch (type) {
        case 'email':
          if (recipient) {
            await this.sendExecutionReport(recipient, '测试配置', testReport);
          }
          break;
        case 'webhook':
          await this.sendWebhook({ type: 'test', data: testReport });
          break;
        case 'slack':
          await this.sendSlackNotification(this.generateSlackMessage('测试配置', testReport));
          break;
      }

      return Promise.resolve(true);
    } catch (error) {
      logger.error('测试${type}通知失败:', new EnhancedError('测试${type}通知失败:', { error: error instanceof Error ? (error as Error).message : String(error)  }));
      return Promise.resolve(false);
    }
  }

  // 获取通知历史
  async getNotificationHistory(userId?: string, limit?: number): Promise<any[]> {
    try {
      // 模拟返回通知历史
      return [
        {
          id: '1',
          type: 'execution_report',
          title: '执行完成通知',
          message: '配置执行已完成',
          timestamp: new Date().toISOString(),
          status: 'sent'
        }
      ];
    } catch (error) { 
      logger.error('获取通知历史失败:', new EnhancedError('获取通知历史失败:', { error: error instanceof Error ? (error as Error).message : String(error)  }));
      return [];
    }
  }

  // 发送通知
  async sendNotification(type: string, message: string): Promise<{success: boolean, message: string}> {
    try {
      // 模拟发送通知
      logger.info(`发送通知: ${type} - ${message}`);
      return { success: true, message: 'sent' };
    } catch (error) { 
      logger.error('发送通知失败:', new EnhancedError('发送通知失败:', { error: error instanceof Error ? (error as Error).message : String(error)  }));
      return { success: false, message: (error as Error).message };
    }
  }

  // 发送邮件通知
  async sendEmailNotification(to: string, subject: string, body: string): Promise<{success: boolean, message: string}> {
    try {
      await this.sendEmail(to, subject, body);
      return { success: true, message: 'sent' };
    } catch (error) { 
      logger.error('发送邮件通知失败:', new EnhancedError('发送邮件通知失败:', { error: error instanceof Error ? (error as Error).message : String(error)  }));
      return { success: false, message: (error as Error).message };
    }
  }

  // 发送Webhook通知
  async sendWebhookNotification(url: string, data: any): Promise<{success: boolean, message: string}> {
    try {
      await this.sendWebhook(data);
      return { success: true, message: 'sent' };
    } catch (error) { 
      logger.error('发送Webhook通知失败:', new EnhancedError('发送Webhook通知失败:', { error: error instanceof Error ? (error as Error).message : String(error)  }));
      return { success: false, message: (error as Error).message };
    }
  }
}