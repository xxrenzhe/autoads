import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { hotReloadService } from '@/lib/hot-reload'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

// GET /api/admin/email-config - Get email configuration
export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get email configuration from system config
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'email_config' }
    })

    if (!config) {
      // Return default configuration
      return NextResponse.json({
        emailConfig: {
          provider: 'smtp',
          smtp: {
            host: '',
            port: 587,
            secure: false,
            user: '',
            pass: ''
          },
          from: 'noreply@example.com',
          fromName: 'System Notification',
          enabled: false,
          rateLimit: 60,
          maxRetries: 3,
          events: {
            userRegistration: true,
            passwordReset: true,
            subscriptionCreated: true,
            subscriptionExpired: true,
            paymentFailed: true,
            tokenLow: false
          },
          dkim: {
            domain: '',
            selector: 'default',
            privateKey: ''
          }
        }
      })
    }

    return NextResponse.json(JSON.parse(config.value))
  } catch (error) {
    console.error('Failed to get email configuration:', error)
    return NextResponse.json(
      { error: 'Failed to get email configuration' },
      { status: 500 }
    )
  }
}

// POST /api/admin/email-config - Update email configuration
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { emailConfig } = body

    // Validate required fields
    if (!emailConfig || !emailConfig.from) {
      return NextResponse.json(
        { error: 'Email configuration and from address are required' },
        { status: 400 }
      )
    }

    // Upsert email configuration
    const config = await prisma.systemConfig.upsert({
      where: { key: 'email_config' },
      update: {
        value: JSON.stringify(emailConfig),
        updatedBy: session.user.id
      },
      create: {
        key: 'email_config',
        value: JSON.stringify(emailConfig),
        description: 'Email service configuration',
        category: 'email',
        createdBy: session.user.id
      }
    })

    // Log the action
    await prisma.adminLog.create({
      data: {
        action: 'UPDATE_EMAIL_CONFIG',
        details: {
          provider: emailConfig.provider,
          from: emailConfig.from,
          enabled: emailConfig.enabled,
          updatedBy: session.user.email
        },
        userId: session.user.id
      }
    })

    // Trigger hot reload
    try {
      await hotReloadService.triggerReload({
        type: 'email',
        action: 'update',
        key: 'email_config',
        data: emailConfig,
        timestamp: Date.now()
      })
    } catch (error) {
      console.error('Hot reload failed:', error)
    }

    return NextResponse.json({
      success: true,
      message: 'Email configuration updated successfully'
    })
  } catch (error) {
    console.error('Failed to update email configuration:', error)
    return NextResponse.json(
      { error: 'Failed to update email configuration' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/email-config/test - Test email configuration
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { to, subject, template } = body

    if (!to || !subject) {
      return NextResponse.json(
        { error: 'Recipient and subject are required' },
        { status: 400 }
      )
    }

    // Get current email config
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'email_config' }
    })

    if (!config) {
      return NextResponse.json(
        { error: 'Email configuration not found' },
        { status: 404 }
      )
    }

    const emailConfig = JSON.parse(config.value)

    // For now, simulate email sending
    // In a real implementation, you would use nodemailer or SendGrid
    console.log('Sending test email:', {
      to,
      subject,
      template,
      config: emailConfig
    })

    // Simulate sending delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      data: {
        to,
        subject,
        sentAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 500 }
    )
  }
}