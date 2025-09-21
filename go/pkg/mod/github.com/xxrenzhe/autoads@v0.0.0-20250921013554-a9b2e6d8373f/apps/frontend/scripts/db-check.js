#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function expect(cond, message) {
  if (!cond) {
    throw new Error(message)
  }
}

async function main() {
  const out = []
  // latest migration (optional)
  try {
    const rows = await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`
    if (Array.isArray(rows) && rows.length > 0 && rows[0].migration_name) {
      out.push(`latest_migration: ${rows[0].migration_name}`)
    }
  } catch {}
  // Admin user
  const adminCount = await prisma.adminUser.count()
  out.push(`admin_users: ${adminCount}`)
  await expect(adminCount >= 1, 'admin_users should have at least 1 row')

  // Rate limit configs
  const rlcCount = await prisma.rateLimitConfig.count({ where: { isActive: true } })
  out.push(`rate_limit_configs (active): ${rlcCount}`)
  await expect(rlcCount >= 9, 'rate_limit_configs(active) should be >= 9')

  // Token consumption rules
  const tcrCount = await prisma.tokenConsumptionRule.count({ where: { isActive: true } })
  out.push(`token_consumption_rules (active): ${tcrCount}`)
  await expect(tcrCount >= 5, 'token_consumption_rules(active) should be >= 5')

  // Token packages
  const tpCount = await prisma.tokenPackage.count({ where: { isActive: true } })
  out.push(`token_packages (active): ${tpCount}`)
  await expect(tpCount >= 4, 'token_packages(active) should be >= 4')

  // Plan configs
  const pcCount = await prisma.planConfig.count({ where: { isActive: true } })
  out.push(`plan_configs (active): ${pcCount}`)
  await expect(pcCount >= 3, 'plan_configs(active) should be >= 3')

  // Ads metrics - recent window (non-blocking)
  try {
    const recent7 = await prisma.adsMetricsDaily.count({
      where: { date: { gte: new Date(Date.now() - 7*24*60*60*1000) } }
    })
    out.push(`ads_metrics_daily (last7d): ${recent7}`)
  } catch {}

  // System configs keys
  const neededKeys = ['system_name', 'rate_limit_plans', 'maintenance_mode', 'max_upload_size']
  const sys = await prisma.systemConfig.findMany({ where: { key: { in: neededKeys } } })
  const present = new Set(sys.map(s => s.key))
  const missing = neededKeys.filter(k => !present.has(k))
  out.push(`system_configs keys present: ${sys.length}/${neededKeys.length}`)
  await expect(missing.length === 0, `system_configs missing keys: ${missing.join(',')}`)

  console.log('✅ DB read checks passed:')
  out.forEach((line) => console.log(' - ' + line))
}

main()
  .catch((e) => { console.error('❌ DB read checks failed:', e.message || e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
