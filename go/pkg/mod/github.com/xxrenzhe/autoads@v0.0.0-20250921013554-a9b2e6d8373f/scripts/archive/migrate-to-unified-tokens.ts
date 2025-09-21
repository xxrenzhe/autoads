#!/usr/bin/env tsx

/**
 * 迁移脚本：将现有的分类Token余额迁移到统一Token系统
 *
 * 执行步骤：
 * 1. 读取所有用户的分类Token余额
 * 2. 为每种类型的Token创建对应的TokenTransaction记录
 * 3. 更新用户的统一tokenBalance
 * 4. 验证迁移结果
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateToUnifiedTokens() {
  console.log('🚀 开始迁移到统一Token系统...')

  try {
    // 1. 获取所有用户的Token数据
    const users = await prisma.user.findMany({
      select: {
        id: true,
        subscriptionTokenBalance: true,
        activityTokenBalance: true,
        purchasedTokenBalance: true,
        tokenBalance: true,
        createdAt: true,
      },
    })

    console.log(`📊 找到 ${users.length} 个用户需要迁移`)

    let migratedCount = 0
    let skippedCount = 0

    for (const user of users) {
      const subscriptionTokens = user.subscriptionTokenBalance || 0
      const activityTokens = user.activityTokenBalance || 0
      const purchasedTokens = user.purchasedTokenBalance || 0

      // 计算总Token数
      const totalTokens = subscriptionTokens + activityTokens + purchasedTokens

      // 如果用户没有任何Token，跳过
      if (totalTokens === 0) {
        skippedCount++
        continue
      }

      console.log(
        `👤 迁移用户 ${user.id}: 订阅=${subscriptionTokens}, 活动=${activityTokens}, 购买=${purchasedTokens}`
      )

      await prisma.$transaction(async tx => {
        let currentBalance = 0

        // 2. 为每种类型的Token创建TokenTransaction记录

        // 2.1 迁移活动Token（永不过期）
        if (activityTokens > 0) {
          await tx.tokenTransaction.create({
            data: {
              userId: user.id,
              type: 'ACTIVITY',
              amount: activityTokens,
              balanceBefore: currentBalance,
              balanceAfter: currentBalance + activityTokens,
              source: 'migration_activity',
              description: `Migrated activity tokens: ${activityTokens}`,
              metadata: {
                tokenSource: 'ACTIVITY',
                migratedAt: new Date().toISOString(),
                originalField: 'activityTokenBalance',
              },
            },
          })
          currentBalance += activityTokens
        }

        // 2.2 迁移购买Token（永不过期）
        if (purchasedTokens > 0) {
          await tx.tokenTransaction.create({
            data: {
              userId: user.id,
              type: 'PURCHASED',
              amount: purchasedTokens,
              balanceBefore: currentBalance,
              balanceAfter: currentBalance + purchasedTokens,
              source: 'migration_purchased',
              description: `Migrated purchased tokens: ${purchasedTokens}`,
              metadata: {
                tokenSource: 'PURCHASED',
                migratedAt: new Date().toISOString(),
                originalField: 'purchasedTokenBalance',
              },
            },
          })
          currentBalance += purchasedTokens
        }

        // 2.3 迁移订阅Token（需要检查是否有活跃订阅）
        if (subscriptionTokens > 0) {
          // 查找用户的活跃订阅
          const activeSubscription = await tx.subscription.findFirst({
            where: {
              userId: user.id,
              status: 'ACTIVE',
            },
            orderBy: {
              currentPeriodEnd: 'desc',
            },
          })

          const expiresAt = activeSubscription?.currentPeriodEnd

          await tx.tokenTransaction.create({
            data: {
              userId: user.id,
              type: 'SUBSCRIPTION',
              amount: subscriptionTokens,
              balanceBefore: currentBalance,
              balanceAfter: currentBalance + subscriptionTokens,
              source: 'migration_subscription',
              description: `Migrated subscription tokens: ${subscriptionTokens}`,
              metadata: {
                tokenSource: 'SUBSCRIPTION',
                migratedAt: new Date().toISOString(),
                originalField: 'subscriptionTokenBalance',
                expiresAt: expiresAt?.toISOString(),
                subscriptionId: activeSubscription?.id,
              },
            },
          })
          currentBalance += subscriptionTokens
        }

        // 3. 更新用户的统一tokenBalance
        await tx.user.update({
          where: { id: user.id },
          data: {
            tokenBalance: totalTokens,
          },
        })
      })

      migratedCount++

      if (migratedCount % 10 === 0) {
        console.log(`✅ 已迁移 ${migratedCount} 个用户...`)
      }
    }

    console.log(`🎉 迁移完成！`)
    console.log(`✅ 成功迁移: ${migratedCount} 个用户`)
    console.log(`⏭️  跳过: ${skippedCount} 个用户（无Token）`)

    // 4. 验证迁移结果
    await validateMigration()
  } catch (error) {
    console.error('❌ 迁移失败:', error)
    throw error
  }
}

async function validateMigration() {
  console.log('\n🔍 验证迁移结果...')

  try {
    // 检查Token余额一致性
    const users = await prisma.user.findMany({
      select: {
        id: true,
        tokenBalance: true,
        subscriptionTokenBalance: true,
        activityTokenBalance: true,
        purchasedTokenBalance: true,
      },
    })

    let inconsistentCount = 0

    for (const user of users) {
      const oldTotal =
        (user.subscriptionTokenBalance || 0) +
        (user.activityTokenBalance || 0) +
        (user.purchasedTokenBalance || 0)
      const newTotal = user.tokenBalance || 0

      if (Math.abs(oldTotal - newTotal) > 0.01) {
        console.warn(`⚠️  用户 ${user.id} Token余额不一致: 旧=${oldTotal}, 新=${newTotal}`)
        inconsistentCount++
      }
    }

    // 检查TokenTransaction记录
    const transactionCount = await prisma.tokenTransaction.count({
      where: {
        source: {
          in: ['migration_activity', 'migration_purchased', 'migration_subscription'],
        },
      },
    })

    console.log(`📊 验证结果:`)
    console.log(`   - Token余额不一致的用户: ${inconsistentCount}`)
    console.log(`   - 创建的迁移交易记录: ${transactionCount}`)

    if (inconsistentCount === 0) {
      console.log('✅ 所有用户的Token余额都已正确迁移！')
    } else {
      console.warn('⚠️  发现Token余额不一致，请检查迁移逻辑')
    }
  } catch (error) {
    console.error('❌ 验证失败:', error)
  }
}

async function rollbackMigration() {
  console.log('🔄 回滚迁移...')

  try {
    // 删除迁移创建的TokenTransaction记录
    const deletedTransactions = await prisma.tokenTransaction.deleteMany({
      where: {
        source: {
          in: ['migration_activity', 'migration_purchased', 'migration_subscription'],
        },
      },
    })

    console.log(`🗑️  删除了 ${deletedTransactions.count} 条迁移交易记录`)

    // 恢复用户的tokenBalance为原来的值
    const users = await prisma.user.findMany({
      select: {
        id: true,
        subscriptionTokenBalance: true,
        activityTokenBalance: true,
        purchasedTokenBalance: true,
      },
    })

    for (const user of users) {
      const originalTotal =
        (user.subscriptionTokenBalance || 0) +
        (user.activityTokenBalance || 0) +
        (user.purchasedTokenBalance || 0)

      await prisma.user.update({
        where: { id: user.id },
        data: {
          tokenBalance: originalTotal,
        },
      })
    }

    console.log('✅ 迁移已回滚')
  } catch (error) {
    console.error('❌ 回滚失败:', error)
    throw error
  }
}

// 主函数
async function main() {
  const command = process.argv[2]

  switch (command) {
    case 'migrate':
      await migrateToUnifiedTokens()
      break
    case 'validate':
      await validateMigration()
      break
    case 'rollback':
      await rollbackMigration()
      break
    default:
      console.log('使用方法:')
      console.log('  npm run migrate-tokens migrate   # 执行迁移')
      console.log('  npm run migrate-tokens validate  # 验证迁移结果')
      console.log('  npm run migrate-tokens rollback  # 回滚迁移')
      break
  }
}

if (require.main === module) {
  main()
    .catch(error => {
      console.error('脚本执行失败:', error)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}

export { migrateToUnifiedTokens, validateMigration, rollbackMigration }
