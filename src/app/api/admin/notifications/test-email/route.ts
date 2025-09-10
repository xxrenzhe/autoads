import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { createSecureHandler } from '@/lib/utils/api-security'

const TestEmailSchema = z.object({
  to: z.string().email(),
  template: z.string(),
  subject: z.string(),
})

async function handlePOST(request: NextRequest, { user }: any) {
  try {
    const body = await request.json()
    const { to, template, subject } = TestEmailSchema.parse(body)

    // 获取邮件配置
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'email_config' },
    })

    if (!config) {
      return NextResponse.json(
        { success: false, message: '邮件配置未找到' },
        { status: 404 }
      )
    }

    const emailConfig = JSON.parse(config.value)

    // 这里应该集成实际的邮件发送服务
    // 例如：nodemailer、SendGrid 等
    console.log('Sending test email:', {
      to,
      subject,
      template,
      config: emailConfig,
    })

    // 模拟发送延迟
    await new Promise(resolve => setTimeout(resolve, 1000))

    return NextResponse.json({
      success: true,
      message: '测试邮件已发送',
      data: {
        to,
        subject,
        sentAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json(
      { success: false, message: '发送失败' },
      { status: 500 }
    )
  }
}

export const POST = createSecureHandler({
  requireAuth: true,
  validation: {},
  handler: handlePOST,
})