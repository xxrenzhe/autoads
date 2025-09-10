import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAdminUser() {
  try {
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@autoads.dev' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        isActive: true,
        password: true
      }
    })
    
    if (adminUser) {
      console.log('Admin user found:', {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        status: adminUser.status,
        isActive: adminUser.isActive,
        hasPassword: !!adminUser.password
      })
      return adminUser
    } else {
      console.log('Admin user not found')
      return null
    }
  } catch (error) {
    console.error('Error checking admin user:', error)
    return null
  } finally {
    await prisma.$disconnect()
  }
}

checkAdminUser()