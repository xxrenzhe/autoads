// 统一使用全局单例 Prisma 客户端
export { prisma } from '../prisma';

// 导出初始化/关闭包装，避免多处 new PrismaClient()
export async function initializeDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

export async function shutdownDatabase() {
  try {
    await prisma.$disconnect();
  } catch {}
}
