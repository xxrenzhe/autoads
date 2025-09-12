import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeUserIssue() {
  try {
    console.log('🔍 深度分析用户问题...\n');
    
    // 查找问题用户
    const problemUser = await prisma.user.findUnique({
      where: { email: 'yj2008ay611@gmail.com' },
      include: {
        tokenTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        invitations: {
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        invitedBy: true,
        checkIns: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!problemUser) {
      console.log('❌ 未找到问题用户');
      return;
    }

    console.log('👤 问题用户详细信息:');
    console.log(`   邮箱: ${problemUser.email}`);
    console.log(`   姓名: ${problemUser.name || 'N/A'}`);
    console.log(`   状态: ${problemUser.status}`);
    console.log(`   角色: ${problemUser.role}`);
    console.log(`   创建时间: ${problemUser.createdAt.toISOString()}`);
    console.log(`   最后登录: ${problemUser.lastLoginAt?.toISOString() || 'N/A'}`);
    console.log(`   登录次数: ${problemUser.loginCount}`);
    console.log(`   邮箱验证: ${problemUser.emailVerified ? '已验证' : '未验证'}`);
    console.log();

    console.log('💰 Token余额详情:');
    console.log(`   传统Token余额: ${problemUser.tokenBalance || 0}`);
    console.log(`   购买Token余额: ${problemUser.purchasedTokenBalance || 0}`);
    console.log(`   订阅Token余额: ${problemUser.subscriptionTokenBalance || 0}`);
    console.log(`   活动Token余额: ${problemUser.activityTokenBalance || 0}`);
    console.log(`   本月已使用: ${problemUser.tokenUsedThisMonth || 0}`);
    
    const totalTokens = (problemUser.tokenBalance || 0) + 
                       (problemUser.purchasedTokenBalance || 0) + 
                       (problemUser.subscriptionTokenBalance || 0) + 
                       (problemUser.activityTokenBalance || 0);
    console.log(`   总Token余额: ${totalTokens}`);
    console.log();

    console.log('📝 Token交易历史:');
    if (problemUser.tokenTransactions.length === 0) {
      console.log('   ❌ 没有任何Token交易记录');
    } else {
      problemUser.tokenTransactions.forEach(tx => {
        console.log(`   ${tx.createdAt.toISOString().split('T')[0]} - ${tx.type}: ${tx.amount} (${tx.source})`);
      });
    }
    console.log();

    console.log('📋 订阅历史:');
    if (problemUser.subscriptions.length === 0) {
      console.log('   ❌ 没有任何订阅记录');
    } else {
      problemUser.subscriptions.forEach(sub => {
        console.log(`   ${sub.createdAt.toISOString().split('T')[0]} - ${sub.status}: ${sub.planId}`);
      });
    }
    console.log();

    console.log('🎫 邀请相关:');
    if (problemUser.invitedBy) {
      console.log(`   被邀请人: ${problemUser.invitedBy.inviterEmail || 'N/A'}`);
    } else {
      console.log('   ❌ 没有邀请记录');
    }
    
    if (problemUser.invitations.length > 0) {
      console.log('   发出的邀请:');
      problemUser.invitations.forEach(inv => {
        console.log(`     ${inv.code} - ${inv.status} (${inv.createdAt.toISOString().split('T')[0]})`);
      });
    } else {
      console.log('   ❌ 没有发出邀请');
    }
    console.log();

    console.log('✅ 签到记录:');
    if (problemUser.checkIns.length === 0) {
      console.log('   ❌ 没有签到记录');
    } else {
      problemUser.checkIns.forEach(checkin => {
        console.log(`   ${checkin.createdAt.toISOString().split('T')[0]} - 奖励: ${checkin.tokensEarned || 0} tokens`);
      });
    }
    console.log();

    // 分析问题原因
    console.log('🔍 问题分析:');
    const issues = [];
    
    if (totalTokens === 0) {
      issues.push('Token余额为0');
      
      // 检查是否应该有初始Token
      if (problemUser.tokenTransactions.length === 0) {
        issues.push('从未获得过任何Token');
      }
      
      if (!problemUser.invitedBy) {
        issues.push('没有通过邀请注册（错过邀请奖励）');
      }
      
      if (problemUser.checkIns.length === 0) {
        issues.push('从未签到（错过签到奖励）');
      }
      
      if (problemUser.subscriptions.length === 0) {
        issues.push('没有订阅（错过订阅Token）');
      }
    }

    if (problemUser.status !== 'ACTIVE') {
      issues.push(`账户状态异常: ${problemUser.status}`);
    }

    issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
    console.log();

    // 提供解决方案
    console.log('💡 建议解决方案:');
    console.log('   1. 给用户添加初始活动Token (100个)');
    console.log('   2. 确保用户状态为ACTIVE');
    console.log('   3. 创建Token交易记录以便追踪');
    console.log('   4. 建议用户进行首次签到获得额外奖励');
    console.log();

    // 检查其他用户的情况作为对比
    console.log('📊 对比分析 - 其他用户情况:');
    const otherUsers = await prisma.user.findMany({
      where: {
        email: {
          not: 'yj2008ay611@gmail.com'
        }
      },
      select: {
        email: true,
        tokenBalance: true,
        purchasedTokenBalance: true,
        subscriptionTokenBalance: true,
        activityTokenBalance: true,
        status: true,
        createdAt: true
      }
    });

    otherUsers.forEach(user => {
      const userTotal = (user.tokenBalance || 0) + 
                       (user.purchasedTokenBalance || 0) + 
                       (user.subscriptionTokenBalance || 0) + 
                       (user.activityTokenBalance || 0);
      console.log(`   ${user.email}: ${userTotal} tokens, 状态: ${user.status}`);
    });

  } catch (error) {
    console.error('❌ 分析用户问题时出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 直接运行脚本
analyzeUserIssue().catch(console.error);

export { analyzeUserIssue };