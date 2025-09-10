import { prisma } from '../src/lib/db'

async function migrateConfigurations() {
  console.log('开始迁移配置数据...')

  try {
    // 获取所有环境变量
    const envVars = await prisma.environmentVariable.findMany()
    
    console.log(`找到 ${envVars.length} 个环境变量配置`)

    // 根据键名推断分类
    const categorizeConfig = (key: string): 'system' | 'features' | 'security' => {
      if (key.startsWith('FEATURE_') || key.startsWith('ENABLE_')) {
        return 'features'
      }
      if (key.includes('SECRET') || key.includes('KEY') || key.includes('PASSWORD')) {
        return 'security'
      }
      return 'system'
    }

    // 迁移每个配置
    for (const envVar of envVars) {
      const category = categorizeConfig(envVar.key)
      
      // 检查是否已存在
      const existing = await prisma.systemConfig.findUnique({
        where: { key: envVar.key }
      })

      if (!existing) {
        await prisma.systemConfig.create({
          data: {
            key: envVar.key,
            value: envVar.value,
            category,
            isSecret: envVar.isSecret,
            createdBy: envVar.createdBy,
            updatedBy: envVar.updatedBy,
            createdAt: envVar.createdAt,
            updatedAt: envVar.updatedAt
          }
        })
        
        console.log(`迁移配置: ${envVar.key} -> ${category}`)
      } else {
        console.log(`配置已存在，跳过: ${envVar.key}`)
      }
    }

    console.log('配置迁移完成!')
  } catch (error) {
    console.error('迁移失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 执行迁移
migrateConfigurations()