// ESM seed script for Prisma (Node 20)
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function seedAdminUser() {
  const email = 'admin@autoads.com'
  const username = 'admin'
  const passwordHash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' // bcrypt for 'password'
  try {
    await prisma.adminUser.upsert({
      where: { email },
      update: {},
      create: {
        username,
        email,
        password: passwordHash,
        role: 'super_admin',
        isActive: true,
      },
    })
    console.log('✅ 默认管理员账户创建/存在')
  } catch (e) {
    console.warn('Admin user seed skipped:', e?.message || e)
  }
}

async function seedRateLimitConfigs() {
  const now = new Date()
  const rows = [
    { id: 'rlc_FREE_API', plan: 'FREE', feature: 'API', perMinute: 10, perHour: 300, concurrent: 0 },
    { id: 'rlc_FREE_SITE_RANK', plan: 'FREE', feature: 'SITE_RANK', perMinute: 2, perHour: 50, concurrent: 0 },
    { id: 'rlc_FREE_BATCH', plan: 'FREE', feature: 'BATCH', perMinute: 5, perHour: 300, concurrent: 1 },
    { id: 'rlc_PRO_API', plan: 'PRO', feature: 'API', perMinute: 100, perHour: 5000, concurrent: 0 },
    { id: 'rlc_PRO_SITE_RANK', plan: 'PRO', feature: 'SITE_RANK', perMinute: 10, perHour: 200, concurrent: 0 },
    { id: 'rlc_PRO_BATCH', plan: 'PRO', feature: 'BATCH', perMinute: 20, perHour: 1200, concurrent: 5 },
    { id: 'rlc_MAX_API', plan: 'MAX', feature: 'API', perMinute: 500, perHour: 20000, concurrent: 0 },
    { id: 'rlc_MAX_SITE_RANK', plan: 'MAX', feature: 'SITE_RANK', perMinute: 50, perHour: 1000, concurrent: 0 },
    { id: 'rlc_MAX_BATCH', plan: 'MAX', feature: 'BATCH', perMinute: 100, perHour: 6000, concurrent: 20 },
  ]
  for (const r of rows) {
    await prisma.rateLimitConfig.upsert({
      where: { id: r.id },
      update: {},
      create: { ...r, isActive: true, createdAt: now, updatedAt: now },
    })
  }
  console.log(`✅ 速率限制配置：${rows.length} 项`)
}

async function seedTokenConsumptionRules() {
  const rules = [
    { service: 'batchgo', action: 'basic_task', tokenCost: 1, description: 'BatchGo基础任务每个URL消费1个Token' },
    { service: 'batchgo', action: 'advanced_task', tokenCost: 2, description: 'BatchGo高级任务每个URL消费2个Token' },
    { service: 'siterank', action: 'query', tokenCost: 1, description: 'SiteRank查询每个域名消费1个Token' },
    { service: 'adscenter', action: 'extract_link', tokenCost: 1, description: '自动化广告：链接提取消费1个Token' },
    { service: 'adscenter', action: 'update_ad', tokenCost: 3, description: '自动化广告：广告更新每个广告消费3个Token' },
    { service: 'chengelink', action: 'extract_link', tokenCost: 1, description: '兼容：chengelink 链接提取消费1个Token' },
    { service: 'chengelink', action: 'update_ad', tokenCost: 3, description: '兼容：chengelink 广告更新每个广告消费3个Token' },
    { service: 'checkin', action: 'daily', tokenCost: 10, description: '每日签到奖励10个Token' },
  ]
  for (const it of rules) {
    await prisma.tokenConsumptionRule.upsert({
      where: { service_action: { service: it.service, action: it.action } },
      update: {},
      create: { ...it, isActive: true },
    })
  }
  console.log(`✅ Token消费规则：${rules.length} 项`)
}

async function seedSystemConfigs() {
  const defaults = [
    {
      key: 'system_name',
      value: 'GoFly Admin V3',
      category: 'system',
      description: '系统名称',
      isSecret: false,
      isActive: true,
    },
    {
      key: 'rate_limit_plans',
      // 与后端读取兼容(JSON 字符串)
      value: JSON.stringify({ FREE: { rps: 5, burst: 10 }, PRO: { rps: 50, burst: 100 }, MAX: { rps: 200, burst: 400 } }),
      category: 'ratelimit',
      description: '按套餐的默认限流配置(JSON)',
      isSecret: false,
      isActive: true,
    },
    {
      key: 'maintenance_mode',
      value: 'false',
      category: 'system',
      description: '维护模式',
      isSecret: false,
      isActive: true,
    },
    {
      key: 'max_upload_size',
      value: '10485760',
      category: 'upload',
      description: '最大上传大小（字节）',
      isSecret: false,
      isActive: true,
    },
  ]
  for (const cfg of defaults) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      update: {},
      create: { ...cfg, createdBy: 'system', updatedBy: 'system' },
    })
  }
  console.log(`✅ 系统配置：${defaults.length} 项`)
}

async function seedTokenPackages() {
  const now = new Date()
  const packages = [
    { name: '小包', tokenAmount: 10000, price: 99.0, bonusTokens: 0, description: '¥99 = 10,000 tokens', sortOrder: 1 },
    { name: '中包', tokenAmount: 50000, price: 299.0, bonusTokens: 0, description: '¥299 = 50,000 tokens', sortOrder: 2 },
    { name: '大包', tokenAmount: 200000, price: 599.0, bonusTokens: 0, description: '¥599 = 200,000 tokens', sortOrder: 3 },
    { name: '超大包', tokenAmount: 500000, price: 999.0, bonusTokens: 0, description: '¥999 = 500,000 tokens', sortOrder: 4 },
  ]
  for (const p of packages) {
    await prisma.tokenPackage.upsert({
      where: { name: p.name },
      update: {},
      create: { ...p, isActive: true, createdAt: now, updatedAt: now },
    })
  }
  console.log(`✅ Token套餐：${packages.length} 项`)
}

async function seedPlanConfigs() {
  const plans = [
    {
      name: 'free',
      displayName: '免费套餐（Free）',
      description: '“真实点击”功能（初级/静默）；“网站排名”批量查询上限100个/次；包含1,000 tokens',
      price: 0.0,
      duration: 30,
      batchgoEnabled: true,
      siterankEnabled: true,
      adscenterEnabled: false,
      maxBatchSize: 10,
      maxConcurrency: 1,
      maxSiterankQueries: 100,
      maxAdscenterAccounts: 0,
      initialTokens: 1000,
      dailyTokens: 0,
      isActive: true,
    },
    {
      name: 'pro',
      displayName: '高级套餐（Pro）',
      description: '支持免费套餐全部功能；“真实点击”新增自动化版本；“网站排名”上限500个/次；“自动化广告”支持管理至多10个ads账号；包含10,000 tokens',
      price: 298.0,
      duration: 30,
      batchgoEnabled: true,
      siterankEnabled: true,
      adscenterEnabled: true,
      maxBatchSize: 50,
      maxConcurrency: 3,
      maxSiterankQueries: 500,
      maxAdscenterAccounts: 10,
      initialTokens: 10000,
      dailyTokens: 0,
      isActive: true,
    },
    {
      name: 'max',
      displayName: '白金套餐（Max）',
      description: '支持高级套餐全部功能；“网站排名”上限5000个/次；“自动化广告”支持管理至多100个ads账号；包含100,000 tokens',
      price: 998.0,
      duration: 30,
      batchgoEnabled: true,
      siterankEnabled: true,
      adscenterEnabled: true,
      maxBatchSize: 200,
      maxConcurrency: 10,
      maxSiterankQueries: 5000,
      maxAdscenterAccounts: 100,
      initialTokens: 100000,
      dailyTokens: 0,
      isActive: true,
    },
  ]
  for (const p of plans) {
    await prisma.planConfig.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    })
  }
  console.log(`✅ 套餐配置(plan_configs)：${plans.length} 项`)
}

async function main() {
  await seedAdminUser()
  await seedRateLimitConfigs()
  await seedTokenConsumptionRules()
  await seedSystemConfigs()
  await seedTokenPackages()
  await seedPlanConfigs()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
