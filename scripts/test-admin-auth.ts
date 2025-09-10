import { NextAuthConfig } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "../src/lib/db"
import bcrypt from "bcryptjs"

export async function testAdminAuth() {
  console.log("🔍 Testing admin authentication...")
  
  // Test 1: Check if admin user exists
  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@autoads.dev" },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      password: true,
      isActive: true,
    }
  })
  
  if (!adminUser) {
    console.error("❌ Admin user not found")
    return
  }
  
  console.log("✅ Admin user found:", {
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
    status: adminUser.status,
    isActive: adminUser.isActive,
    hasPassword: !!adminUser.password
  })
  
  // Test 2: Test password verification
  const testPassword = "admin123" // Assuming this is the password
  const isValidPassword = await bcrypt.compare(testPassword, adminUser.password!)
  
  console.log("🔐 Password verification:", isValidPassword ? "✅ Valid" : "❌ Invalid")
  
  // Test 3: Check environment variables
  console.log("🌍 Environment variables:")
  console.log("  AUTH_SECRET:", process.env.AUTH_SECRET ? "✅ Set" : "❌ Missing")
  console.log("  AUTH_URL:", process.env.AUTH_URL || "Auto-detected")
  console.log("  NODE_ENV:", process.env.NODE_ENV)
  console.log("  NEXT_PUBLIC_DEPLOYMENT_ENV:", process.env.NEXT_PUBLIC_DEPLOYMENT_ENV)
  
  // Test 4: Check JWT token creation
  try {
    const { SignJWT } = await import('jose')
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET!)
    
    const testToken = await new SignJWT({ userId: adminUser.id, email: adminUser.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret)
    
    console.log("✅ JWT token creation successful")
    console.log("Token length:", testToken.length)
  } catch (error) {
    console.error("❌ JWT token error:", error)
  }
}

// Run the test
testAdminAuth().catch(console.error)