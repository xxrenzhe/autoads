// Re-export NextAuth v5 configuration for backward compatibility
export { handlers, auth, signIn, signOut } from './auth/v5-config'

// Export authOptions for v4 compatibility
export { authOptions } from './next-auth-compatibility'