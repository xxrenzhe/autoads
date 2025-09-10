/**
 * NextAuth v5 Beta Compatibility Layer
 * Provides backward compatibility for v4 patterns while using v5 beta
 */

import { handlers, auth } from "./auth/v5-config"

// Export auth as the default handler for App Router
export const { GET, POST } = handlers

// For getServerSession compatibility
export async function getServerSession(options?: any): Promise<any> {
  // In v5, we use the auth() function to get the session
  try {
    const session = await auth()
    
    // Transform v5 session to v4-compatible format
    if (session?.user) {
      return {
        user: {
          id: (session.user as any).id || 'unknown',
          email: session.user.email || '',
          name: session.user.name,
          role: (session.user as any).role || 'USER',
          status: (session.user as any).status || 'ACTIVE',
          emailVerified: (session.user as any).emailVerified || false
        },
        accessToken: (session as any).accessToken,
        userId: (session as any).userId || (session.user as any).id
      }
    }
    
    return null
  } catch (error) {
    console.error('Error getting server session:', error)
    return null
  }
}

// Export authOptions for compatibility
export const authOptions = {
  // Your auth options from v5 config
  providers: [], // Add your providers
  session: {
    strategy: "jwt" as const,
  },
  pages: {
    signIn: "/auth/signin",
  },
}
