/** @type {import('next').NextConfig} */
const nextConfig = {
  // 生产环境优化 - 启用standalone模式以支持Docker部署
  output: 'standalone',
  
  // 环境变量配置
  env: {
    CUSTOM_KEY: 'changelink-autoads',
    DEPLOYMENT_DOMAIN: process.env.DEPLOYMENT_DOMAIN,
    NEXT_PUBLIC_DEPLOYMENT_ENV: process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || process.env.NODE_ENV,
  },

  // 服务器配置
  serverRuntimeConfig: {
    // 服务器端配置
  },
  
  // 公共运行时配置
  publicRuntimeConfig: {
    // 客户端和服务器端都可访问的配置
  },

  // 重定向配置
  async redirects() {
    return [
      // 移除首页重定向，让首页正常显示
    ];
  },

  // 重写配置
  async rewrites() {
    return [
      {
        source: '/api/changelink/:path*',
        destination: '/api/changelink/:path*',
      },
    ];
  },

  // 头部配置（按环境分级）
  async headers() {
    const env = process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || process.env.NODE_ENV || 'development';
    const isProd = env === 'production';
    const cspParts = [
      "default-src 'self'",
      // 生产禁用 unsafe-eval，保留必要的 inline 以兼容 GA 初始化
      isProd
        ? "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob: https://www.google.com https://www.google-analytics.com",
      "font-src 'self'",
      // 仅在开发环境允许本地 Adspower
      isProd
        ? "connect-src 'self' https://accounts.google.com https://www.googleapis.com https://data.similarweb.com https://api.similarweb.com https://similarweb.com https://urlchecker.dev https://www.urlchecker.dev https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://ipapi.co"
        : "connect-src 'self' http://local.adspower.net:50325 https://accounts.google.com https://www.googleapis.com https://data.similarweb.com https://api.similarweb.com https://similarweb.com https://urlchecker.dev https://www.urlchecker.dev https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://ipapi.co",
      "frame-src 'self' https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ];

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // 生产启用一年 HSTS，其他环境禁用
          { key: 'Strict-Transport-Security', value: isProd ? 'max-age=31536000; includeSubDomains; preload' : 'max-age=0' },
          { key: 'Content-Security-Policy', value: cspParts.join('; ') },
        ],
      },
    ];
  },

  // 图片优化配置
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'autoads.dev',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.autoads.dev',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'urlchecker.dev',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.urlchecker.dev',
        pathname: '/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
  },

  // 压缩配置
  compress: true,

  // 构建配置 - 使用standalone模式优化生产部署
  // standalone模式包含所有必要的依赖，简化部署
  
  // TypeScript/ESLint 配置（预发先启用严格校验）
  typescript: {
    // 开启 preview 与 production 的严格校验
    ignoreBuildErrors: !['preview', 'production'].includes((process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || '').toLowerCase()),
  },

  eslint: {
    ignoreDuringBuilds: !['preview', 'production'].includes((process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || '').toLowerCase()),
  },

  // 服务器端外部模块
  serverExternalPackages: ['playwright', 'playwright-core'],

  // 性能配置
  poweredByHeader: false,
  generateEtags: true,
  
  // Next.js 15 默认启用 SWC 压缩和字体优化

  // Webpack配置 - 简化配置，专注于标准Next.js优化
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Enable minification in production
    if (!dev) {
      config.optimization.minimize = true;
    }
    
    // 优化配置
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            enforce: true,
          },
        },
      };
    }

    // 处理 Node.js 模块在客户端构建中的问题
    if (!isServer) {
      config.externals = config.externals || [];
      // 客户端不应该包含这些 Node.js 模块
      config.externals.push(
        'fs',
        'net',
        'tls',
        'dns',
        'dgram',
        'child_process',
        'cluster',
        'repl',
        'readline',
        'vm',
        'worker_threads',
        'winston',
        'winston-daily-rotate-file',
        'file-stream-rotator',
        'ioredis',
        'socket.io'
      );
    }

    // 处理 Playwright 模块在 Docker 环境中的问题
    if (!isServer) {
      config.externals = config.externals || [];
      config.externals.push('playwright', 'playwright-core');
    }

    return config;
  },
};

export default nextConfig;
