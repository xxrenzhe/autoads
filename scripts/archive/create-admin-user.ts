import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createAdminUser() {
  try {
    const email = 'admin@autoads.dev'
    const password = 'Admin@2024!AutoAds$Secure'
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    
    if (existingUser) {
      console.log('User already exists, updating to admin...')
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 12)
      
      // Update existing user to admin
      const updatedUser = await prisma.user.update({
        where: { email },
        data: {
          role: 'ADMIN',
          status: 'ACTIVE',
          isActive: true,
          password: hashedPassword,
          name: 'Super Admin',
          emailVerified: true
        }
      })
      
      console.log('User updated to admin:', {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status
      })
    } else {
      console.log('Creating new admin user...')
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 12)
      
      // Create new admin user
      const newAdmin = await prisma.user.create({
        data: {
          email,
          name: 'Super Admin',
          role: 'ADMIN',
          status: 'ACTIVE',
          isActive: true,
          password: hashedPassword,
          emailVerified: true,
          tokenBalance: 10000 // Give admin some tokens
        }
      })
      
      console.log('Admin user created:', {
        id: newAdmin.id,
        email: newAdmin.email,
        role: newAdmin.role,
        status: newAdmin.status,
        tokenBalance: newAdmin.tokenBalance
      })
    }
  } catch (error) {
    console.error('Error creating admin user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdminUser()