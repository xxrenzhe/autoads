import nodemailer from 'nodemailer'

export interface EmailConfig {
  provider: 'smtp' | 'sendgrid' | 'ses'
  smtp?: {
    host: string
    port: number
    secure: boolean
    auth: {
      user: string
      pass: string
    }
  }
  sendgrid?: {
    apiKey: string
  }
  ses?: {
    region: string
    accessKeyId: string
    secretAccessKey: string
  }
}

export interface EmailMessage {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  replyTo?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
}

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null
  private static config: EmailConfig | null = null

  /**
   * 初始化邮件服务
   */
  static async initialize(config?: EmailConfig): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // 如果没有提供配置，从环境变量读取
      if (!config) {
        config = this.getConfigFromEnv()
      }

      this.config = config

      switch (config.provider) {
        case 'smtp':
          if (!config.smtp) {
            return {
              success: false,
              error: 'SMTP configuration is required'
            }
          }

          this.transporter = nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.secure,
            auth: config.smtp.auth
          })
          break

        case 'sendgrid':
          if (!config.sendgrid?.apiKey) {
            return {
              success: false,
              error: 'SendGrid API key is required'
            }
          }

          // 使用 SendGrid 的 SMTP 接口
          this.transporter = nodemailer.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            secure: false,
            auth: {
              user: 'apikey',
              pass: config.sendgrid.apiKey
            }
          })
          break

        case 'ses':
          if (!config.ses) {
            return {
              success: false,
              error: 'AWS SES configuration is required'
            }
          }

          // 使用 AWS SES SMTP 接口
          this.transporter = nodemailer.createTransport({
            host: `email-smtp.${config.ses.region}.amazonaws.com`,
            port: 587,
            secure: false,
            auth: {
              user: config.ses.accessKeyId,
              pass: config.ses.secretAccessKey
            }
          })
          break

        default:
          return {
            success: false,
            error: 'Unsupported email provider'
          }
      }

      // 验证连接
      await this.transporter.verify()

      return { success: true }
    } catch (error) {
      console.error('Failed to initialize email service:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize email service'
      }
    }
  }

  /**
   * 发送邮件
   */
  static async sendEmail(message: EmailMessage): Promise<{
    success: boolean
    messageId?: string
    error?: string
  }> {
    try {
      if (!this.transporter) {
        const initResult = await this.initialize()
        if (!initResult.success) {
          return {
            success: false,
            error: 'Email service not initialized: ' + initResult.error
          }
        }
      }

      const defaultFrom = process.env.EMAIL_FROM || 'noreply@autoads.com'
      
      const mailOptions = {
        from: message.from || defaultFrom,
        to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
        attachments: message.attachments
      }

      const result = await this.transporter!.sendMail(mailOptions)

      return {
        success: true,
        messageId: result.messageId
      }
    } catch (error) {
      console.error('Failed to send email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email'
      }
    }
  }

  /**
   * 批量发送邮件
   */
  static async sendBulkEmails(messages: EmailMessage[]): Promise<{
    success: boolean
    sent: number
    failed: number
    errors: string[]
  }> {
    let sent = 0
    let failed = 0
    const errors: string[] = []

    for (const message of messages) {
      try {
        const result = await this.sendEmail(message)
        if (result.success) {
          sent++
        } else {
          failed++
          errors.push(`${message.to}: ${result.error}`)
        }
      } catch (error) {
        failed++
        errors.push(`${message.to}: ${error}`)
      }
    }

    return {
      success: failed === 0,
      sent,
      failed,
      errors
    }
  }

  /**
   * 测试邮件配置
   */
  static async testConfiguration(config?: EmailConfig): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const testConfig = config || this.getConfigFromEnv()
      
      // 临时创建测试传输器
      let testTransporter: nodemailer.Transporter

      switch (testConfig.provider) {
        case 'smtp':
          if (!testConfig.smtp) {
            return { success: false, error: 'SMTP configuration missing' }
          }
          testTransporter = nodemailer.createTransport({
            host: testConfig.smtp.host,
            port: testConfig.smtp.port,
            secure: testConfig.smtp.secure,
            auth: testConfig.smtp.auth
          })
          break

        case 'sendgrid':
          if (!testConfig.sendgrid?.apiKey) {
            return { success: false, error: 'SendGrid API key missing' }
          }
          testTransporter = nodemailer.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            secure: false,
            auth: {
              user: 'apikey',
              pass: testConfig.sendgrid.apiKey
            }
          })
          break

        case 'ses':
          if (!testConfig.ses) {
            return { success: false, error: 'AWS SES configuration missing' }
          }
          testTransporter = nodemailer.createTransport({
            host: `email-smtp.${testConfig.ses.region}.amazonaws.com`,
            port: 587,
            secure: false,
            auth: {
              user: testConfig.ses.accessKeyId,
              pass: testConfig.ses.secretAccessKey
            }
          })
          break

        default:
          return { success: false, error: 'Unsupported provider' }
      }

      // 验证连接
      await testTransporter.verify()
      
      return { success: true }
    } catch (error) {
      console.error('Email configuration test failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Configuration test failed'
      }
    }
  }

  /**
   * 从环境变量获取配置
   */
  private static getConfigFromEnv(): EmailConfig {
    const provider = (process.env.EMAIL_PROVIDER || 'smtp') as 'smtp' | 'sendgrid' | 'ses'

    switch (provider) {
      case 'smtp':
        return {
          provider: 'smtp',
          smtp: {
            host: process.env.SMTP_HOST || 'localhost',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER || '',
              pass: process.env.SMTP_PASS || ''
            }
          }
        }

      case 'sendgrid':
        return {
          provider: 'sendgrid',
          sendgrid: {
            apiKey: process.env.SENDGRID_API_KEY || ''
          }
        }

      case 'ses':
        return {
          provider: 'ses',
          ses: {
            region: process.env.AWS_SES_REGION || 'us-east-1',
            accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || ''
          }
        }

      default:
        return {
          provider: 'smtp',
          smtp: {
            host: 'localhost',
            port: 587,
            secure: false,
            auth: { user: '', pass: '' }
          }
        }
    }
  }

  /**
   * 获取当前配置状态
   */
  static getStatus(): {
    initialized: boolean
    provider?: string
    ready: boolean
  } {
    return {
      initialized: this.transporter !== null,
      provider: this.config?.provider,
      ready: this.transporter !== null && this.config !== null
    }
  }

  /**
   * 重置服务（用于重新配置）
   */
  static reset(): void {
    this.transporter = null
    this.config = null
  }
}