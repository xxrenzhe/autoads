import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkUserData() {
  try {
    console.log('🔍 检查用户数据...\n')

    // 获取所有用户的基本信息
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        role: true,
        tokenBalance: true,
        purchasedTokenBalance: true,
        subscriptionTokenBalance: true,
        activityTokenBalance: true,
        tokenUsedThisMonth: true,
        createdAt: true,
        lastLoginAt: true,
        loginCount: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    console.log(`📊 总用户数: ${users.length}\n`)

    if (users.length === 0) {
      console.log('❌ 数据库中没有用户数据')
      return
    }

    // 分析用户状态
    const statusStats = users.reduce(
      (acc, user) => {
        acc[user.status] = (acc[user.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    console.log('📈 用户状态统计:')
    Object.entries(statusStats).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} 用户`)
    })
    console.log()

    // 分析Token余额
    const zeroTokenUsers = users.filter(user => {
      const totalTokens =
        (user.tokenBalance || 0) +
        (user.purchasedTokenBalance || 0) +
        (user.subscriptionTokenBalance || 0) +
        (user.activityTokenBalance || 0)
      return totalTokens === 0
    })

    console.log(`💰 Token余额统计:`)
    console.log(`   零Token用户: ${zeroTokenUsers.length} / ${users.length}`)
    console.log(`   有Token用户: ${users.length - zeroTokenUsers.length} / ${users.length}`)
    console.log()

    // 显示前10个用户的详细信息
    console.log('👥 用户详细信息 (前10个):')
    console.log('─'.repeat(120))
    console.log(
      '邮箱'.padEnd(30) +
        '状态'.padEnd(12) +
        '总Token'.padEnd(10) +
        '购买'.padEnd(8) +
        '订阅'.padEnd(8) +
        '活动'.padEnd(8) +
        '传统'.padEnd(8) +
        '创建时间'
    )
    console.log('─'.repeat(120))

    users.slice(0, 10).forEach(user => {
      const totalTokens =
        (user.tokenBalance || 0) +
        (user.purchasedTokenBalance || 0) +
        (user.subscriptionTokenBalance || 0) +
        (user.activityTokenBalance || 0)

      console.log(
        (user.email || 'N/A').padEnd(30) +
          user.status.padEnd(12) +
          totalTokens.toString().padEnd(10) +
          (user.purchasedTokenBalance || 0).toString().padEnd(8) +
          (user.subscriptionTokenBalance || 0).toString().padEnd(8) +
          (user.activityTokenBalance || 0).toString().padEnd(8) +
          (user.tokenBalance || 0).toString().padEnd(8) +
          user.createdAt.toISOString().split('T')[0]
      )
    })

    console.log('─'.repeat(120))

    // 检查问题用户
    const problemUsers = users.filter(user => {
      const totalTokens =
        (user.tokenBalance || 0) +
        (user.purchasedTokenBalance || 0) +
        (user.subscriptionTokenBalance || 0) +
        (user.activityTokenBalance || 0)
      return user.status !== 'ACTIVE' || totalTokens === 0
    })

    if (problemUsers.length > 0) {
      console.log(`\n⚠️  发现 ${problemUsers.length} 个问题用户:`)
      problemUsers.forEach(user => {
        const issues = []
        if (user.status !== 'ACTIVE') {
          issues.push(`状态: ${user.status}`)
        }
        const totalTokens =
          (user.tokenBalance || 0) +
          (user.purchasedTokenBalance || 0) +
          (user.subscriptionTokenBalance || 0) +
          (user.activityTokenBalance || 0)
        if (totalTokens === 0) {
          issues.push('Token余额为0')
        }
        console.log(`   ${user.email}: ${issues.join(', ')}`)
      })
    }

    // 检查Token交易记录
    const tokenTransactions = await prisma.tokenTransaction.count()
    console.log(`\n💳 Token交易记录总数: ${tokenTransactions}`)

    if (tokenTransactions > 0) {
      const recentTransactions = await prisma.tokenTransaction.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { email: true },
          },
        },
      })

      console.log('\n📝 最近的Token交易:')
      recentTransactions.forEach(tx => {
        console.log(`   ${tx.user.email}: ${tx.type} ${tx.amount} tokens (${tx.source})`)
      })
    }
  } catch (error) {
    console.error('❌ 检查用户数据时出错:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 直接运行脚本
checkUserData().catch(console.error)

export { checkUserData }
