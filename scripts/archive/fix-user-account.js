import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixUserAccount() {
  try {
    const userEmail = 'yj2008ay611@gmail.com';
    
    console.log('Fixing account for user:', userEmail);
    
    // Update user to set isActive=true since status is ACTIVE
    const updatedUser = await prisma.user.update({
      where: { email: userEmail },
      data: { 
        isActive: true,
        // Also add some initial tokens for new user
        tokenBalance: 100
      }
    });
    
    console.log('\n=== UPDATED USER INFO ===');
    console.log('Email:', updatedUser.email);
    console.log('Status:', updatedUser.status);
    console.log('isActive:', updatedUser.isActive);
    console.log('Token Balance:', updatedUser.tokenBalance);
    
    // Log the change
    await prisma.adminLog.create({
      data: {
        action: 'FIX_ACCOUNT_STATUS',
        details: {
          reason: 'User had status=ACTIVE but isActive=false. Fixed to match.',
          previousIsActive: false,
          newIsActive: true,
          previousTokenBalance: 0,
          newTokenBalance: 100
        },
        userId: updatedUser.id
      }
    });
    
    console.log('\n✅ Account fixed successfully!');
    console.log('The user should now see "账户正常" instead of "账户已禁用"');
    
  } catch (error) {
    console.error('Error fixing user account:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserAccount();