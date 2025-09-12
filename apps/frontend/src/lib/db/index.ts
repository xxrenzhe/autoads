import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// 导出初始化函数
export async function initializeDatabase() {
  try {
    // 测试数据库连接
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// 优雅关闭
export async function shutdownDatabase() {
  await prisma.$disconnect();
}
