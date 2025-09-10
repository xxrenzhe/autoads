import { PrismaClient } from '../src/lib/types/prisma-types'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 开始数据库种子数据初始化...')

  // 1. 创建默认套餐
  console.log('📦 创建默认套餐...')
  
  // 检查是否已存在Free套餐
  let freePlan = await prisma.plan.findFirst({
    where: { name: 'Free' }
  })
  
  if (!freePlan) {
    freePlan = await prisma.plan.create({
      data: {
      name: 'Free',
      description: '免费套餐，适合个人用户体验基础功能',
      price: 0,
      currency: 'USD',
      interval: 'MONTH',
      tokenQuota: 100, // 每月100个Token
      // tokenReset: 'MONTHLY', // This field doesn't exist in the schema
      // sortOrder: 1, // This field doesn't exist in the schema
      features: {
        siterank: {
          enabled: true,
          tokensPerQuery: 1,
          maxQueriesPerBatch: 10,
          exportFormats: ['csv']
        },
        batchopen: {
          enabled: true,
          tokensPerUrl: 1,
          maxUrlsPerBatch: 20,
          proxyRotation: false,
          customReferer: false
        },
        changelink: {
          enabled: false,
          tokensPerExecution: 5,
          maxAccountsManaged: 0,
          scheduledTasks: false,
          advancedReporting: false
        }
      },
      // limits: { // This field doesn't exist in the schema
      //   apiCallsPerMinute: 10,
      //   concurrentRequests: 2,
      //   dataRetentionDays: 7,
      //   supportLevel: 'BASIC'
      // },
      isActive: true
      }
    })
  }

  // 检查是否已存在Pro套餐
  let proPlan = await prisma.plan.findFirst({
    where: { name: 'Pro' }
  })
  
  if (!proPlan) {
    proPlan = await prisma.plan.create({
      data: {
      name: 'Pro',
      description: '专业套餐，适合中小企业和专业用户',
      price: 29.99,
      currency: 'USD',
      interval: 'MONTH',
      tokenQuota: 1000, // 每月1000个Token
      // tokenReset: 'MONTHLY', // This field doesn't exist in the schema
      // sortOrder: 2, // This field doesn't exist in the schema
      features: {
        siterank: {
          enabled: true,
          tokensPerQuery: 1,
          maxQueriesPerBatch: 100,
          exportFormats: ['csv', 'excel', 'pdf']
        },
        batchopen: {
          enabled: true,
          tokensPerUrl: 1,
          maxUrlsPerBatch: 200,
          proxyRotation: true,
          customReferer: true
        },
        changelink: {
          enabled: true,
          tokensPerExecution: 5,
          maxAccountsManaged: 5,
          scheduledTasks: true,
          advancedReporting: true
        }
      },
      // limits: { // This field doesn't exist in the schema
      //   apiCallsPerMinute: 60,
      //   concurrentRequests: 10,
      //   dataRetentionDays: 30,
      //   supportLevel: 'PRIORITY'
      // },
      isActive: true
      }
    })
  }

  // 检查是否已存在Max套餐
  let maxPlan = await prisma.plan.findFirst({
    where: { name: 'Max' }
  })
  
  if (!maxPlan) {
    maxPlan = await prisma.plan.create({
      data: {
      name: 'Max',
      description: '白金套餐，适合大型企业和高级用户',
      price: 99.99,
      currency: 'USD',
      interval: 'MONTH',
      tokenQuota: 5000, // 每月5000个Token
      // tokenReset: 'MONTHLY', // This field doesn't exist in the schema
      // sortOrder: 3, // This field doesn't exist in the schema
      features: {
        siterank: {
          enabled: true,
          tokensPerQuery: 1,
          maxQueriesPerBatch: 1000,
          exportFormats: ['csv', 'excel', 'pdf', 'json']
        },
        batchopen: {
          enabled: true,
          tokensPerUrl: 1,
          maxUrlsPerBatch: 1000,
          proxyRotation: true,
          customReferer: true
        },
        changelink: {
          enabled: true,
          tokensPerExecution: 5,
          maxAccountsManaged: 20,
          scheduledTasks: true,
          advancedReporting: true
        }
      },
      // limits: { // This field doesn't exist in the schema
      //   apiCallsPerMinute: 300,
      //   concurrentRequests: 50,
      //   dataRetentionDays: 90,
      //   supportLevel: 'PREMIUM'
      // },
      isActive: true
      }
    })
  }

  console.log(`✅ 创建套餐: ${freePlan.name}, ${proPlan.name}, ${maxPlan.name}`)

  // 2. 创建系统管理员用户
  console.log('👤 创建系统管理员用户...')
  
  // 生成复杂密码: Admin@2024!AutoAds$Secure
  const adminPassword = await bcrypt.hash('Admin@2024!AutoAds$Secure', 12)
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@autoads.dev' },
    update: {},
    create: {
      email: 'admin@autoads.dev',
      name: '系统管理员',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      tokenBalance: 10000,
      // tokenUsedThisMonth: 0, // This field doesn't exist in the schema
      // loginCount: 0, // This field doesn't exist in the schema
      // preferences: { // This field doesn't exist in the schema
      //   language: 'zh',
      //   timezone: 'Asia/Shanghai',
      //   emailNotifications: true,
      //   smsNotifications: false,
      //   theme: 'light'
      // }
    }
  })

  const testUser = await prisma.user.upsert({
    where: { email: 'test@gmail.com' },
    update: {},
    create: {
      email: 'test@gmail.com',
      name: '测试用户',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      tokenBalance: 100,
      // tokenUsedThisMonth: 0, // This field doesn't exist in the schema
      // loginCount: 0, // This field doesn't exist in the schema
      // preferences: { // This field doesn't exist in the schema
      //   language: 'zh',
      //   timezone: 'Asia/Shanghai',
      //   emailNotifications: true,
      //   smsNotifications: false,
      //   theme: 'light'
      // }
    }
  })

  console.log(`✅ 创建用户: ${adminUser.email}, ${testUser.email}`)
  console.log(`🔑 管理员账号信息:`)
  console.log(`   邮箱: admin@autoads.dev`)
  console.log(`   密码: Admin@2024!AutoAds$Secure`)
  console.log(`   角色: ADMIN`)
  console.log(`   ⚠️  请在首次登录后立即修改密码！`)

  // 3. 创建默认系统配置
  console.log('⚙️ 创建默认系统配置...')
  
  const systemConfigs = [
    {
      key: 'SITE_NAME',
      value: 'AutoAds自动化营销平台',
      description: '网站名称'
    },
    {
      key: 'SITE_URL',
      value: 'https://autoads.dev',
      description: '网站URL'
    },
    {
      key: 'SUPPORT_EMAIL',
      value: 'support@autoads.dev',
      description: '客服邮箱'
    },
    {
      key: 'MAX_FILE_SIZE',
      value: '10485760', // 10MB
      description: '最大文件上传大小（字节）'
    },
    {
      key: 'TOKEN_RESET_DAY',
      value: '1',
      description: 'Token重置日期（每月第几天）'
    },
    {
      key: 'DEFAULT_RATE_LIMIT',
      value: '100',
      description: '默认API速率限制（每分钟请求数）'
    },
    {
      key: 'SMTP_HOST',
      value: '',
      description: 'SMTP服务器地址'
    },
    {
      key: 'SMTP_PORT',
      value: '587',
      description: 'SMTP端口'
    },
    {
      key: 'SMTP_USER',
      value: '',
      description: 'SMTP用户名'
    },
    {
      key: 'SMTP_PASS',
      value: '',
      description: 'SMTP密码'
    }
  ]

  for (const config of systemConfigs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: {
        ...config,
        category: 'system',
        createdBy: adminUser.id,
        updatedBy: adminUser.id
      }
    })
  }

  console.log(`✅ 创建系统配置: ${systemConfigs.length} 项`)

  // 4. 创建默认通知模板
  console.log('📧 创建默认通知模板...')
  
  const notificationTemplates = [
    {
      name: 'welcome_email',
      type: 'EMAIL' as const,
      subject: '欢迎使用AutoAds自动化营销平台',
      content: '亲爱的 {{userName}}，\n\n欢迎使用AutoAds自动化营销平台！\n\n您的账户已成功创建，现在可以开始使用我们的服务：\n- 网站排名分析 (SiteRank)\n- 真实点击工具 (BatchOpen)\n- 自动化广告管理 (ChangeLink)\n\n您当前的套餐：{{planName}}\nToken余额：{{tokenBalance}}\n\n如有任何问题，请联系我们的客服团队。\n\n祝您使用愉快！\nAutoAds团队',
      variables: ['userName', 'planName', 'tokenBalance'],
      isActive: true
    },
    {
      name: 'subscription_created',
      type: 'EMAIL' as const,
      subject: '订阅确认 - AutoAds',
      content: '亲爱的 {{userName}}，\n\n感谢您订阅AutoAds {{planName}} 套餐！\n\n订阅详情：\n- 套餐：{{planName}}\n- 价格：${{price}}/{{interval}}\n- Token配额：{{tokenQuota}}/月\n- 下次续费：{{nextBillingDate}}\n\n您现在可以享受更多功能和更高的使用配额。\n\nAutoAds团队',
      variables: ['userName', 'planName', 'price', 'interval', 'tokenQuota', 'nextBillingDate'],
      isActive: true
    },
    {
      name: 'payment_failed',
      type: 'EMAIL' as const,
      subject: '支付失败通知 - AutoAds',
      content: '亲爱的 {{userName}}，\n\n您的订阅支付未能成功处理。\n\n失败原因：{{failureReason}}\n订阅：{{planName}}\n金额：${{amount}}\n\n请更新您的支付方式或联系客服解决此问题。\n\nAutoAds团队',
      variables: ['userName', 'planName', 'amount', 'failureReason'],
      isActive: true
    },
    {
      name: 'token_low_warning',
      type: 'EMAIL' as const,
      subject: 'Token余额不足提醒 - AutoAds',
      content: '亲爱的 {{userName}}，\n\n您的Token余额即将用完：\n\n当前余额：{{currentBalance}}\n本月已使用：{{usedThisMonth}}\n套餐配额：{{monthlyQuota}}\n\n建议您升级套餐或等待下月Token重置。\n\nAutoAds团队',
      variables: ['userName', 'currentBalance', 'usedThisMonth', 'monthlyQuota'],
      isActive: true
    }
  ]

  for (const template of notificationTemplates) {
    await prisma.notificationTemplate.upsert({
      where: { name: template.name },
      update: {},
      create: template
    })
  }

  console.log(`✅ 创建通知模板: ${notificationTemplates.length} 个`)

  // 5. 为测试用户创建免费套餐订阅
  console.log('📋 创建测试订阅...')
  
  // 检查是否已存在订阅
  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      userId: testUser.id,
      planId: freePlan.id,
      status: 'ACTIVE'
    }
  })

  let testSubscription
  if (!existingSubscription) {
    testSubscription = await prisma.subscription.create({
      data: {
        userId: testUser.id,
        planId: freePlan.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后
        provider: 'system' // 系统赠送的免费套餐
      }
    })
  } else {
    testSubscription = existingSubscription
  }

  console.log(`✅ 创建测试订阅: ${testUser.email} -> ${freePlan.name}`)

  // 6. 套餐功能配置已直接存储在plan表的features字段中
  console.log('✅ 套餐功能配置已包含在套餐数据中')

  // 7. 配置项功能已使用systemConfig表实现
  console.log('✅ 系统配置已使用systemConfig表实现')

  // 8. 功能标志功能暂未实现
  console.log('✅ 功能标志功能暂未实现')

  // 9. 支付提供商功能暂未实现
  console.log('✅ 支付提供商功能暂未实现')

  // 10. 管理员仪表板功能暂未实现
  console.log('✅ 管理员仪表板功能暂未实现')

  console.log('🎉 数据库种子数据初始化完成！')
  console.log('\n📊 初始化统计:')
  console.log(`- 套餐: 3个 (Free, Pro, Max)`)
  console.log(`- 用户: 2个 (管理员, 测试用户)`)
  console.log(`- 系统配置: ${systemConfigs.length}项`)
  console.log(`- 通知模板: ${notificationTemplates.length}个`)
  console.log(`- 订阅: 1个 (测试用户免费套餐)`)
  console.log('- 套餐功能: 已包含在套餐数据中')
  console.log('- 配置项: 使用systemConfig表实现')
  console.log('- 功能标志: 暂未实现')
  console.log('- 支付提供商: 暂未实现')
  console.log('- 管理员仪表板: 暂未实现')
}

main()
  .catch((e) => {
    console.error('❌ 种子数据初始化失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })