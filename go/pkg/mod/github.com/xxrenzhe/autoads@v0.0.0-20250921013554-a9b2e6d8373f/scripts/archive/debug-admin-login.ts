import { PrismaClient } from '../src/lib/types/prisma-types'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function debugAdminLogin() {
  try {
    console.log('🔍 Debugging admin login issue...')
    
    // Test credentials
    const testEmail = 'admin@autoads.dev'
    const testPassword = 'Admin@2024!AutoAds$Secure'
    
    console.log('\n📋 Test Credentials:')
    console.log('   Email:', testEmail)
    console.log('   Password:', testPassword)
    
    // 1. Check if user exists
    console.log('\n1. 👤 Checking user existence...')
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        emailVerified: true,
        password: true,
        createdAt: true,
        updatedAt: true
      }
    })
    
    if (!user) {
      console.error('❌ User not found in database!')
      return
    }
    
    console.log('✅ User found:')
    console.log('   ID:', user.id)
    console.log('   Email:', user.email)
    console.log('   Name:', user.name)
    console.log('   Role:', user.role)
    console.log('   Status:', user.status)
    console.log('   Email Verified:', user.emailVerified)
    console.log('   Password Length:', user.password ? user.password.length : 'NULL')
    console.log('   Created:', user.createdAt)
    console.log('   Updated:', user.updatedAt)
    
    // 2. Check if password hash exists
    if (!user.password) {
      console.error('\n❌ Password hash is missing from database!')
      console.log('   This is likely the cause of the login failure.')
      return
    }
    
    // 3. Test password verification
    console.log('\n2. 🔐 Testing password verification...')
    const isValid = await bcrypt.compare(testPassword, user.password)
    console.log('   Password verification result:', isValid ? '✅ PASSED' : '❌ FAILED')
    
    if (!isValid) {
      console.log('\n🔧 Possible issues:')
      console.log('   1. The password was changed after seeding')
      console.log('   2. The password hash was corrupted')
      console.log('   3. There is a mismatch between local and production databases')
      
      // Let's try to see if there's a different password that works
      console.log('\n📝 Checking if user was updated recently...')
      if (user.updatedAt > user.createdAt) {
        console.log('   ⚠️  User was updated after creation. Password might have been changed.')
      }
    }
    
    // 4. Check admin role requirements
    console.log('\n3. 🛡️  Checking admin requirements...')
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
    console.log('   Is admin role:', isAdmin ? '✅ YES' : '❌ NO')
    console.log('   Account is active:', user.status === 'ACTIVE' ? '✅ YES' : '❌ NO')
    console.log('   Email is verified:', user.emailVerified ? '✅ YES' : '❌ NO')
    
    // 5. Generate new password hash if needed
    if (!isValid) {
      console.log('\n4. 🔧 Generating new password hash...')
      const newPasswordHash = await bcrypt.hash(testPassword, 12)
      console.log('   New password hash generated:', newPasswordHash.substring(0, 20) + '...')
      
      // Update the user with new password
      console.log('\n5. 💾 Updating user password in database...')
      const updated = await prisma.user.update({
        where: { email: testEmail },
        data: { password: newPasswordHash }
      })
      
      console.log('✅ Password updated successfully!')
      console.log('   New password length:', updated.password.length)
      
      // Test the new password
      const newIsValid = await bcrypt.compare(testPassword, updated.password)
      console.log('   New password verification:', newIsValid ? '✅ PASSED' : '❌ FAILED')
    }
    
    // 6. Summary
    console.log('\n6. 📊 Summary:')
    if (isValid || (user.password && user.role === 'SUPER_ADMIN' && user.status === 'ACTIVE')) {
      console.log('✅ Admin authentication should work now!')
      console.log('\n🔑 Try logging in with:')
      console.log('   URL: /auth/admin-signin')
      console.log('   Email: admin@autoads.dev')
      console.log('   Password: Admin@2024!AutoAds$Secure')
    } else {
      console.log('❌ There are still issues preventing admin login')
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugAdminLogin()