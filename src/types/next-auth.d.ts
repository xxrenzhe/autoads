import 'next-auth'
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    accessToken?: string
    userId?: string
    user: {
      id: string
      email: string
      name?: string
      image?: string
      role: string
      status: string
      emailVerified: boolean
    } & DefaultSession['user']
  }

  interface User {
    id: string
    email: string
    name?: string
    image?: string
    role: string
    status: string
    emailVerified: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string
    userId?: string
    role?: string
    status?: string
    email?: string
    name?: string
    picture?: string
    emailVerified?: boolean
  }
}