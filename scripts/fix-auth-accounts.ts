import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixAuthAccounts() {
  console.log('🔧 Checking and fixing NextAuth account inconsistencies...')
  
  try {
    // Get all users without Google accounts
    const usersWithoutAccounts = await prisma.user.findMany({
      where: {
        accounts: {
          none: {
            provider: 'google'
          }
        },
        email: {
          endsWith: '@gmail.com'
        }
      },
      include: {
        accounts: true
      }
    })

    console.log(`Found ${usersWithoutAccounts.length} Gmail users without Google accounts`)

    if (usersWithoutAccounts.length === 0) {
      console.log('✅ No inconsistencies found')
      return
    }

    // For each user, create a placeholder Google account if they have a Gmail address
    for (const user of usersWithoutAccounts) {
      console.log(`\nProcessing user: ${user.email} (ID: ${user.id})`)
      
      // Extract Google ID from email or use email as fallback
      // In a real scenario, you'd need the actual Google ID from the OAuth provider
      // For now, we'll use a placeholder approach
      const googleId = user.email?.replace('@gmail.com', '') || user.id
      
      try {
        // Check if account already exists (just to be safe)
        const existingAccount = await prisma.account.findFirst({
          where: {
            provider: 'google',
            providerAccountId: googleId
          }
        })

        if (!existingAccount) {
          // Create a placeholder account record
          await prisma.account.create({
            data: {
              userId: user.id,
              provider: 'google',
              providerAccountId: googleId,
              type: 'oauth',
              // Note: In a real fix, you'd need the actual OAuth tokens
              // This is just to make the database consistent
              scope: 'openid email profile',
              token_type: 'Bearer'
            }
          })
          
          console.log(`✅ Created Google account for ${user.email}`)
        } else {
          console.log(`⚠️  Account already exists for ${user.email}`)
        }
      } catch (error) {
        console.error(`❌ Failed to create account for ${user.email}:`, error)
      }
    }

    // Also check for orphaned accounts (accounts without users)
    const orphanedAccounts = await prisma.account.findMany({
      where: {
        user: null
      }
    })

    if (orphanedAccounts.length > 0) {
      console.log(`\n🗑️  Found ${orphanedAccounts.length} orphaned accounts, cleaning up...`)
      
      await prisma.account.deleteMany({
        where: {
          user: null
        }
      })
      
      console.log('✅ Cleaned up orphaned accounts')
    }

    console.log('\n✅ Database consistency check complete')
    
  } catch (error) {
    console.error('❌ Error fixing auth accounts:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the function
fixAuthAccounts()
  .catch(console.error)
  .finally(() => process.exit(0))