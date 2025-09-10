import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateUserStatus() {
  try {
    console.log('🔧 Fixing user session data...\n');
    
    // Update user to ensure consistency
    const updatedUser = await prisma.user.update({
      where: { email: 'yj2008ay611@gmail.com' },
      data: {
        // Ensure all status fields are consistent
        status: 'ACTIVE',
        isActive: true,
        lastLoginAt: new Date(),
        loginCount: {
          increment: 1
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        isActive: true,
        lastLoginAt: true,
        loginCount: true,
        tokenBalance: true,
        subscriptionTokenBalance: true,
        activityTokenBalance: true,
        purchasedTokenBalance: true,
      }
    });

    console.log('✅ User updated successfully:');
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Name: ${updatedUser.name}`);
    console.log(`   Status: ${updatedUser.status}`);
    console.log(`   Is Active: ${updatedUser.isActive}`);
    console.log(`   Last Login: ${updatedUser.lastLoginAt?.toISOString()}`);
    console.log(`   Login Count: ${updatedUser.loginCount}`);
    console.log(`   Token Balance: ${updatedUser.tokenBalance + updatedUser.subscriptionTokenBalance + updatedUser.activityTokenBalance + updatedUser.purchasedTokenBalance}`);
    
    // Also check if there are any duplicate accounts
    const duplicateAccounts = await prisma.user.findMany({
      where: {
        email: 'yj2008ay611@gmail.com',
        id: {
          not: updatedUser.id
        }
      }
    });
    
    if (duplicateAccounts.length > 0) {
      console.log(`\n⚠️  Found ${duplicateAccounts.length} duplicate accounts`);
      console.log('This might explain why the user is seen as "new"');
    } else {
      console.log('\n✅ No duplicate accounts found');
    }
    
  } catch (error) {
    console.error('❌ Error updating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
updateUserStatus().catch(console.error);