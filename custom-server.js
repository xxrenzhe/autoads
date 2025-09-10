/**
 * @deprecated 此自定义服务器已弃用
 * 
 * 项目已迁移到标准Next.js启动方式以提高稳定性和简化部署。
 * 
 * 推荐使用:
 * - 开发环境: npm run dev (使用 next dev)
 * - 生产环境: npm start (使用 next start)
 * 
 * 如有特殊需求仍需使用自定义服务器，请使用: npm run dev:custom
 * 
 * 迁移指南: 请查看 MIGRATION_GUIDE.md
 */

import { createServer } from 'http';
import { URL } from 'url';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = process.env.PORT || 3000;

// 创建 Next.js 应用实例
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// 全局错误处理
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // 给进程时间完成日志记录
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 内存监控
if (dev === false) {
  setInterval(() => {
    const used = process.memoryUsage();
    console.log('Memory Usage:', {
      rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(used.external / 1024 / 1024)}MB`
    });

    // 如果内存使用超过 1GB，警告
    if (used.heapUsed > 1024 * 1024 * 1024) {
      console.warn('High memory usage detected:', Math.round(used.heapUsed / 1024 / 1024) + 'MB');
    }
  }, 30000); // 每30秒检查一次
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      // 记录请求信息用于调试
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Host: ${req.headers.host}`);

      // 安全的URL解析，避免重定向问题
      let parsedUrl;
      try {
        // 确保URL格式正确
        const cleanUrl = req.url.startsWith('/') ? req.url : `/${req.url}`;
        parsedUrl = new URL(cleanUrl, `http://${req.headers.host}`);
      } catch (urlError) {
        console.error('URL parsing error:', urlError, 'Original URL:', req.url);
        // 回退到简单的路径处理
        parsedUrl = { pathname: req.url.split('?')[0], search: req.url.includes('?') ? req.url.split('?')[1] : '' };
      }

      const pathname = parsedUrl.pathname;

      // 显式处理 API 路由
      if (pathname.startsWith('/api/')) {
        console.log(`[API Route] Handling: ${pathname}`);
        // 让 Next.js 处理 API 路由，不设置额外头部
        await handle(req, res);
        return;
      }

      // 处理所有其他请求
      await handle(req, res);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // 优雅关闭处理
  const gracefulShutdown = (signal) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);

    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });

    // 强制关闭超时
    setTimeout(() => {
      console.error('Force closing after timeout');
      process.exit(1);
    }, 10000);
  };

  // 监听关闭信号
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  server
    .on('error', (err) => {
      console.error('Server error:', err);
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
        process.exit(1);
      }
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Environment: ${process.env.NODE_ENV || 'development'}`);
    });
});