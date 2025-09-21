import { PrismaClient } from '../src/lib/types/prisma-types'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function fixAdminPassword() {
  try {
    console.log('🔧 Fixing admin password...')
    
    // Find the admin user
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@autoads.dev' }
    })
    
    if (!adminUser) {
      console.error('❌ Admin user not found!')
      return
    }
    
    console.log('✅ Found admin user:', adminUser.email)
    console.log('📊 Current user state:')
    console.log('   - Role:', adminUser.role)
    console.log('   - Status:', adminUser.status)
    console.log('   - Has password:', !!adminUser.password)
    
    // Hash the password
    const password = 'Admin@2024!AutoAds$Secure'
    const hashedPassword = await bcrypt.hash(password, 12)
    
    console.log('🔐 Generated password hash')
    
    // Update the user with the new password
    const updatedUser = await prisma.user.update({
      where: { email: 'admin@autoads.dev' },
      data: {
        password: hashedPassword,
        emailVerified: true,
        status: 'ACTIVE'
      }
    })
    
    console.log('✅ Updated admin user successfully!')
    console.log('📋 Updated user details:')
    console.log('   - Email:', updatedUser.email)
    console.log('   - Role:', updatedUser.role)
    console.log('   - Status:', updatedUser.status)
    console.log('   - Email verified:', updatedUser.emailVerified)
    console.log('   - Password set:', !!updatedUser.password)
    
    // Verify the password works
    const isValid = await bcrypt.compare(password, hashedPassword)
    console.log('🔍 Password verification test:', isValid ? '✅ PASSED' : '❌ FAILED')
    
  } catch (error) {
    console.error('❌ Error fixing admin password:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixAdminPassword()