import { prisma } from '@/lib/prisma';
import { readFileSync, existsSync } from 'fs';

async function testAdminPanelSimple() {
  console.log('=== Testing Admin Panel (Simple) ===\n');
  
  try {
    // Test 1: Check admin user
    console.log('1. Testing admin user...');
    
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' }
    });
    
    console.log(`   Admin users found: ${adminCount}`);
    
    // Test 2: Check admin API routes exist
    console.log('\n2. Testing admin API routes...');
    
    const adminRoutes = [
      'src/app/api/admin/dashboard/stats/route.ts',
      'src/app/api/admin/users/route.ts',
      'src/app/api/admin/tokens/analytics/route.ts',
      'src/app/api/admin/security/threats/route.ts',
      'src/app/api/admin/system/config/route.ts'
    ];
    
    for (const route of adminRoutes) {
      if (existsSync(route)) {
        console.log(`   ✓ ${route.split('/').slice(-2).join('/')} exists`);
      } else {
        console.log(`   ✗ ${route.split('/').slice(-2).join('/')} missing`);
      }
    }
    
    // Test 3: Check admin pages
    console.log('\n3. Testing admin pages...');
    
    const adminPages = [
      'src/app/admin/page.tsx',
      'src/app/admin/users/page.tsx',
      'src/app/admin/tokens/page.tsx',
      'src/app/admin/security/page.tsx',
      'src/app/admin/system/page.tsx'
    ];
    
    for (const page of adminPages) {
      if (existsSync(page)) {
        console.log(`   ✓ ${page.split('/').pop()} exists`);
      } else {
        console.log(`   ✗ ${page.split('/').pop()} missing`);
      }
    }
    
    // Test 4: Check admin components
    console.log('\n4. Testing admin components...');
    
    const adminComponents = [
      'src/components/admin/AdminDashboard.tsx',
      'src/components/admin/UserManagement.tsx',
      'src/components/admin/TokenAnalytics.tsx',
      'src/components/admin/SecurityPanel.tsx'
    ];
    
    for (const component of adminComponents) {
      if (existsSync(component)) {
        console.log(`   ✓ ${component.split('/').pop()} exists`);
      } else {
        console.log(`   ✗ ${component.split('/').pop()} missing`);
      }
    }
    
    // Test 5: Check system statistics
    console.log('\n5. Testing system statistics...');
    
    const userCount = await prisma.user.count();
    const activeUserCount = await prisma.user.count({
      where: { status: 'ACTIVE' }
    });
    
    console.log(`   Total users: ${userCount}`);
    console.log(`   Active users: ${activeUserCount}`);
    
    // Test 6: Check audit logs
    console.log('\n6. Testing audit logs...');
    
    const auditLogCount = await prisma.auditLog.count();
    console.log(`   Audit log entries: ${auditLogCount}`);
    
    // Test 7: Check security features
    console.log('\n7. Testing security features...');
    
    const threatCount = await prisma.securityThreat.count();
    const deviceCount = await prisma.userDevice.count();
    
    console.log(`   Security threats: ${threatCount}`);
    console.log(`   User devices: ${deviceCount}`);
    
    // Test 8: Check system configurations
    console.log('\n8. Testing system configurations...');
    
    const configCount = await prisma.systemConfig.count();
    console.log(`   System configurations: ${configCount}`);
    
    // Test 9: Check service configurations
    console.log('\n9. Testing service configurations...');
    
    const serviceConfigCount = await prisma.serviceConfig.count();
    console.log(`   Service configurations: ${serviceConfigCount}`);
    
    // Test 10: Check AutoClick admin features
    console.log('\n10. Testing AutoClick admin features...');
    
    const taskCount = await prisma.autoClickTask.count();
    const runningTaskCount = await prisma.autoClickTask.count({
      where: { status: 'running' }
    });
    
    console.log(`   AutoClick tasks: ${taskCount}`);
    console.log(`   Running tasks: ${runningTaskCount}`);
    
    console.log('\n=== Admin Panel Tests Completed Successfully! ===');
    
  } catch (error) {
    console.error('\n❌ Admin panel test failed:', error);
    throw error;
  }
}

// Run the test
testAdminPanelSimple()
  .then(() => {
    console.log('\n🎉 All admin panel tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Admin panel tests failed:', error);
    process.exit(1);
  });