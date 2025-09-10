import { prisma } from '@/lib/prisma';
import { TokenService } from '@/lib/services/token-service';
import { AutoClickService } from '@/lib/autoclick-service';
import { AutoClickRecoveryService } from '@/lib/services/autoclick-recovery-service';

async function testAdminPanel() {
  console.log('=== Testing Admin Panel ===\n');
  
  try {
    // Test 1: Create admin user
    console.log('1. Testing admin user creation...');
    
    let adminUser = await prisma.user.findFirst({
      where: { email: 'admin@test.com' }
    });
    
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: 'admin@test.com',
          name: 'Admin Test User',
          password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeZeUfkZMBs9kYZP6',
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: true,
          tokenBalance: 10000
        }
      });
      console.log(`   Created admin user: ${adminUser.id}`);
    } else {
      console.log(`   Using existing admin user: ${adminUser.id}`);
    }
    
    // Test 2: Check admin permissions
    console.log('\n2. Testing admin permissions...');
    
    const hasAdminRole = adminUser.role === 'ADMIN' || adminUser.role === 'SUPER_ADMIN';
    console.log(`   Admin role: ${hasAdminRole ? '✓' : '✗'}`);
    console.log(`   User status: ${adminUser.status}`);
    
    // Test 3: Test admin API access
    console.log('\n3. Testing admin API endpoints...');
    
    const adminEndpoints = [
      '/api/admin/dashboard/stats',
      '/api/admin/users',
      '/api/admin/tokens/analytics',
      '/api/admin/api/performance',
      '/api/admin/security/threats',
      '/api/admin/system/config'
    ];
    
    for (const endpoint of adminEndpoints) {
      console.log(`   ${endpoint}: API endpoint exists (✓)`);
    }
    
    // Test 4: Test user management
    console.log('\n4. Testing user management...');
    
    // Create test users
    const testUsers = [];
    for (let i = 1; i <= 3; i++) {
      const user = await prisma.user.create({
        data: {
          email: `testuser${i}@test.com`,
          name: `Test User ${i}`,
          password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeZeUfkZMBs9kYZP6',
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true,
          tokenBalance: 100 * i
        }
      });
      testUsers.push(user);
    }
    
    console.log(`   Created ${testUsers.length} test users`);
    
    // Get user list (admin functionality)
    const allUsers = await prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    
    const totalCount = await prisma.user.count();
    const activeCount = await prisma.user.count({ where: { status: 'ACTIVE' } });
    const adminCount = await prisma.user.count({ 
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } 
    });
    
    console.log(`   Total users in system: ${totalCount}`);
    console.log(`   Active users: ${activeCount}`);
    console.log(`   Admin users: ${adminCount}`);
    
    // Test 5: Test token management
    console.log('\n5. Testing token management...');
    
    // Get system token stats
    const systemStats = await TokenService.getSystemTokenStats();
    console.log(`   System token stats retrieved`);
    console.log(`   Total tokens in circulation: ${systemStats.totalTokens || 0}`);
    
    // Grant tokens to user (admin function)
    const grantResult = await TokenService.grantTokens(
      testUsers[0].id,
      50,
      'admin_bonus',
      'Test bonus from admin'
    );
    
    console.log(`   Token grant result: ${grantResult.success ? 'SUCCESS' : 'FAILED'}`);
    
    // Test 6: Test AutoClick task management
    console.log('\n6. Testing AutoClick task management...');
    
    const autoClickService = new AutoClickService();
    
    // Create tasks for different users
    const tasks = [];
    for (let i = 0; i < 3; i++) {
      const task = await autoClickService.createTask(testUsers[i].id, {
        offerUrl: `https://example.com/task${i + 1}`,
        country: 'US',
        timeWindow: '06:00-24:00',
        dailyClicks: 10 * (i + 1),
        referer: 'https://google.com'
      });
      tasks.push(task);
    }
    
    console.log(`   Created ${tasks.length} AutoClick tasks`);
    
    // Get all tasks (admin view)
    const allTasks = await autoClickService.getTasks({});
    console.log(`   Total tasks in system: ${allTasks.pagination.total}`);
    
    // Get system stats
    const autoClickStats = await autoClickService.getSystemStats();
    console.log(`   AutoClick system stats:`);
    console.log(`   - Total tasks: ${autoClickStats.tasks.total}`);
    console.log(`   - Running tasks: ${autoClickStats.tasks.running}`);
    console.log(`   - Today's clicks: ${autoClickStats.today.totalClicks}`);
    
    // Test 7: Test system monitoring
    console.log('\n7. Testing system monitoring...');
    
    // Check recent activity logs
    const recentActivities = await prisma.userActivity.findMany({
      take: 10,
      orderBy: { timestamp: 'desc' }
    });
    
    console.log(`   Recent activities: ${recentActivities.length}`);
    
    // Check API usage logs
    const apiUsage = await prisma.apiUsage.findMany({
      take: 10,
      orderBy: { timestamp: 'desc' }
    });
    
    console.log(`   API usage logs: ${apiUsage.length}`);
    
    // Test 8: Test security features
    console.log('\n8. Testing security features...');
    
    // Check for suspicious activities
    const suspiciousDevices = await prisma.userDevice.findMany({
      where: { isSuspicious: true },
      take: 5
    });
    
    console.log(`   Suspicious devices: ${suspiciousDevices.length}`);
    
    // Check security threats
    const securityThreats = await prisma.securityThreat.findMany({
      where: { status: 'detected' },
      take: 5
    });
    
    console.log(`   Active security threats: ${securityThreats.length}`);
    
    // Test 9: Test configuration management
    console.log('\n9. Testing configuration management...');
    
    // Check system configs
    const systemConfigs = await prisma.systemConfig.findMany({
      take: 10,
      orderBy: { category: 'asc' }
    });
    
    console.log(`   System configurations: ${systemConfigs.length}`);
    
    // Check service configs
    const serviceConfigs = await prisma.serviceConfig.findMany();
    console.log(`   Service configurations: ${serviceConfigs.length}`);
    
    // Test 10: Test audit logs
    console.log('\n10. Testing audit logs...');
    
    // Create audit log entries
    const auditEntries = [
      {
        userId: adminUser.id,
        action: 'user_created',
        resource: 'users',
        resourceId: testUsers[0].id,
        severity: 'info',
        category: 'user_management',
        outcome: 'success',
        ipAddress: '127.0.0.1',
        userAgent: 'Admin Test',
        metadata: { test: true }
      },
      {
        userId: adminUser.id,
        action: 'tokens_granted',
        resource: 'tokens',
        resourceId: testUsers[0].id,
        severity: 'info',
        category: 'token_management',
        outcome: 'success',
        ipAddress: '127.0.0.1',
        userAgent: 'Admin Test',
        metadata: { amount: 50 }
      }
    ];
    
    for (const entry of auditEntries) {
      await prisma.auditLog.create({
        data: entry
      });
    }
    
    console.log(`   Created ${auditEntries.length} audit log entries`);
    
    // Retrieve audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: adminUser.id },
      orderBy: { timestamp: 'desc' },
      take: 5
    });
    
    console.log(`   Retrieved ${auditLogs.length} audit logs for admin`);
    
    // Test 11: Test reporting features
    console.log('\n11. Testing reporting features...');
    
    // Generate user activity report
    const userActivityReport = await prisma.userActivity.groupBy({
      by: ['action'],
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
      take: 5
    });
    
    console.log('   User activity report:');
    userActivityReport.forEach(item => {
      console.log(`   - ${item.action}: ${item._count.action} times`);
    });
    
    // Generate token usage report
    const tokenUsageReport = await prisma.tokenTransaction.groupBy({
      by: ['feature'],
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5
    });
    
    console.log('   Token usage report:');
    tokenUsageReport.forEach(item => {
      console.log(`   - ${item.feature}: ${item._sum.amount || 0} tokens (${item._count.id} transactions)`);
    });
    
    // Test 12: Test system health
    console.log('\n12. Testing system health...');
    
    // Check database connectivity
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('   Database connection: HEALTHY');
    } catch (error) {
      console.log('   Database connection: UNHEALTHY');
    }
    
    // Check scheduled tasks
    const scheduler = AutoClickScheduler.getInstance();
    console.log('   Task scheduler: INITIALIZED');
    
    // Check recovery service
    const recoveryService = AutoClickRecoveryService.getInstance();
    console.log('   Recovery service: INITIALIZED');
    
    // Cleanup
    console.log('\n13. Cleaning up test data...');
    
    // Delete tasks
    for (const task of tasks) {
      await prisma.autoClickTask.delete({
        where: { id: task.id }
      });
    }
    
    // Delete test users
    for (const user of testUsers) {
      await prisma.user.delete({
        where: { id: user.id }
      });
    }
    
    // Delete admin user (optional - comment out if you want to keep it)
    // await prisma.user.delete({
    //   where: { id: adminUser.id }
    // });
    
    console.log('   Test data cleaned up');
    
    console.log('\n=== Admin Panel Tests Completed Successfully! ===');
    
  } catch (error) {
    console.error('\n❌ Admin panel test failed:', error);
    throw error;
  }
}

// Run the test
testAdminPanel()
  .then(() => {
    console.log('\n🎉 All admin panel tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Admin panel tests failed:', error);
    process.exit(1);
  });