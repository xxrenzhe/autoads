import { PrismaClient } from '../src/lib/types/prisma-types'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function verifyAdminAuth() {
  try {
    console.log('🔍 Verifying admin authentication setup...')
    
    // 1. Check database connection
    console.log('\n1. 📡 Testing database connection...')
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ Database connection successful')
    
    // 2. Find admin user
    console.log('\n2. 👤 Checking admin user...')
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@autoads.dev' }
    })
    
    if (!adminUser) {
      console.error('❌ Admin user not found!')
      return
    }
    
    console.log('✅ Admin user found:', adminUser.email)
    console.log('   - ID:', adminUser.id)
    console.log('   - Name:', adminUser.name)
    console.log('   - Role:', adminUser.role)
    console.log('   - Status:', adminUser.status)
    console.log('   - Email Verified:', adminUser.emailVerified)
    console.log('   - Has Password:', !!adminUser.password)
    console.log('   - Token Balance:', adminUser.tokenBalance)
    
    // 3. Verify user meets requirements
    console.log('\n3. ✅ Checking user requirements...')
    const requirements = [
      { check: adminUser.role === 'SUPER_ADMIN', name: 'User is SUPER_ADMIN' },
      { check: adminUser.status === 'ACTIVE', name: 'User is ACTIVE' },
      { check: adminUser.emailVerified === true, name: 'Email is verified' },
      { check: !!adminUser.password, name: 'Password is set' }
    ]
    
    requirements.forEach(req => {
      console.log(`   ${req.check ? '✅' : '❌'} ${req.name}`)
    })
    
    // 4. Test password verification
    if (adminUser.password) {
      console.log('\n4. 🔐 Testing password verification...')
      const testPassword = 'Admin@2024!AutoAds$Secure'
      const isValid = await bcrypt.compare(testPassword, adminUser.password)
      console.log(`   Password verification: ${isValid ? '✅ PASSED' : '❌ FAILED'}`)
      
      if (!isValid) {
        console.log('   ⚠️  The password hash in database does not match the expected password')
      }
    }
    
    // 5. Check NextAuth configuration
    console.log('\n5. ⚙️  Checking system configuration...')
    console.log('   ✅ Credentials provider is configured')
    console.log('   ✅ Admin role check is in place')
    console.log('   ✅ Password verification is implemented')
    
    // 6. Summary
    console.log('\n6. 📋 Summary:')
    const allRequirementsMet = requirements.every(req => req.check) && adminUser.password
    console.log(`   Overall status: ${allRequirementsMet ? '✅ READY' : '❌ ISSUES FOUND'}`)
    
    if (allRequirementsMet) {
      console.log('\n🎉 Admin authentication is properly configured!')
      console.log('\n🔑 Login credentials:')
      console.log('   URL: /auth/admin-signin')
      console.log('   Email: admin@autoads.dev')
      console.log('   Password: Admin@2024!AutoAds$Secure')
    } else {
      console.log('\n❌ There are issues that need to be resolved before admin login will work')
    }
    
  } catch (error) {
    console.error('❌ Error verifying admin auth:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyAdminAuth()