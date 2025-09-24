"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// apps/frontend/next.config.js
var next_config_exports = {};
__export(next_config_exports, {
  default: () => next_config_default
});
module.exports = __toCommonJS(next_config_exports);
var import_path = __toESM(require("path"), 1);
var import_url = require("url");
var import_meta = {};
var nextConfig = {
  // 生产环境优化
  // 注意：为避免 Next.js 15 在构建阶段对 _document 进行不完整的文件跟踪，
  // 暂不启用 standalone 打包（Firebase Web Frameworks 部署不依赖 standalone）。
  // output: 'standalone',
  // 环境变量配置
  env: {
    CUSTOM_KEY: "adscenter-autoads",
    DEPLOYMENT_DOMAIN: process.env.DEPLOYMENT_DOMAIN,
    NEXT_PUBLIC_DEPLOYMENT_ENV: process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || process.env.NODE_ENV
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
        // 兼容旧 API 前缀，重写到新 adscenter 路由
        source: "/api/changelink/:path*",
        destination: "/api/adscenter/:path*"
      }
    ];
  },
  // 头部配置（按环境分级）
  async headers() {
    const env = process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || process.env.NODE_ENV || "development";
    const isProd = env === "production";
    const cspParts = [
      "default-src 'self'",
      // 生产禁用 unsafe-eval，保留必要的 inline 以兼容 GA 初始化
      isProd ? "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com" : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob: https://www.google.com https://www.google-analytics.com",
      "font-src 'self'",
      // 仅在开发环境允许本地 Adspower
      isProd ? "connect-src 'self' https://accounts.google.com https://www.googleapis.com https://data.similarweb.com https://api.similarweb.com https://similarweb.com https://urlchecker.dev https://www.urlchecker.dev https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://ipapi.co" : "connect-src 'self' http://local.adspower.net:50325 https://accounts.google.com https://www.googleapis.com https://data.similarweb.com https://api.similarweb.com https://similarweb.com https://urlchecker.dev https://www.urlchecker.dev https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://ipapi.co",
      "frame-src 'self' https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ];
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // 生产启用一年 HSTS，其他环境禁用
          { key: "Strict-Transport-Security", value: isProd ? "max-age=31536000; includeSubDomains; preload" : "max-age=0" },
          { key: "Content-Security-Policy", value: cspParts.join("; ") }
        ]
      }
    ];
  },
  // 图片优化配置
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "autoads.dev",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "www.autoads.dev",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "urlchecker.dev",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "www.urlchecker.dev",
        pathname: "/**"
      }
    ],
    formats: ["image/webp", "image/avif"]
  },
  // 压缩配置
  compress: true,
  // 构建配置 - 使用standalone模式优化生产部署
  // standalone模式包含所有必要的依赖，简化部署
  // TypeScript/ESLint 配置（预发先启用严格校验）
  typescript: {
    // 预览与开发环境忽略类型检查（降低构建内存占用）；生产开启严格校验
    ignoreBuildErrors: (process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || process.env.NODE_ENV || "development").toLowerCase() !== "production"
  },
  eslint: {
    // 预览与开发环境忽略 ESLint（降低构建内存占用）；生产开启
    ignoreDuringBuilds: (process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || process.env.NODE_ENV || "development").toLowerCase() !== "production"
  },
  // 服务器端外部模块
  serverExternalPackages: ["playwright", "playwright-core", "@google-cloud/pubsub"],
  // 性能配置
  poweredByHeader: false,
  generateEtags: true,
  // Next.js 15 默认启用 SWC 压缩和字体优化
  // Webpack配置 - 简化配置，专注于标准Next.js优化
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    if (!dev) {
      config.optimization.minimize = true;
    }
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: "all",
        cacheGroups: {
          default: false,
          vendors: false,
          vendor: {
            name: "vendor",
            chunks: "all",
            test: /node_modules/
          },
          common: {
            name: "common",
            minChunks: 2,
            chunks: "all",
            enforce: true
          }
        }
      };
    }
    if (!isServer) {
      config.externals = config.externals || [];
      config.externals.push(
        "fs",
        "net",
        "tls",
        "dns",
        "dgram",
        "child_process",
        "cluster",
        "repl",
        "readline",
        "vm",
        "worker_threads",
        "winston",
        "winston-daily-rotate-file",
        "file-stream-rotator",
        "ioredis",
        "socket.io"
      );
    }
    if (!isServer) {
      config.externals = config.externals || [];
      config.externals.push("playwright", "playwright-core");
    }
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias || {},
      "@auth/prisma-adapter": import_path.default.resolve(__dirname, "src/stubs/auth-prisma-adapter.ts"),
      ...isServer ? {
        "google-ads-api": import_path.default.resolve(__dirname, "src/stubs/google-ads-api.ts"),
        "googleapis": import_path.default.resolve(__dirname, "src/stubs/googleapis.ts"),
        "puppeteer": import_path.default.resolve(__dirname, "src/stubs/puppeteer.ts"),
        "exceljs": import_path.default.resolve(__dirname, "src/stubs/exceljs.ts"),
        "swagger-ui-react": import_path.default.resolve(__dirname, "src/stubs/swagger-ui-react.tsx")
      } : {}
    };
    const deployEnv = (process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || process.env.NODE_ENV || "development").toLowerCase();
    const enableStubs = (dev || process.env.ALLOW_STUBS === "true") && deployEnv !== "preview";
    if (enableStubs) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...config.resolve.alias || {},
        "swagger-ui-react": import_path.default.resolve(__dirname, "src/stubs/swagger-ui-react.tsx"),
        "@radix-ui/react-dialog": import_path.default.resolve(__dirname, "src/stubs/radix-dialog.tsx"),
        "@radix-ui/react-avatar": import_path.default.resolve(__dirname, "src/stubs/radix-avatar.tsx"),
        "@radix-ui/react-dropdown-menu": import_path.default.resolve(__dirname, "src/stubs/radix-dropdown.tsx"),
        "@radix-ui/react-switch": import_path.default.resolve(__dirname, "src/stubs/radix-switch.tsx"),
        "exceljs": import_path.default.resolve(__dirname, "src/stubs/exceljs.ts"),
        "@stripe/stripe-js": import_path.default.resolve(__dirname, "src/stubs/stripe-js.ts"),
        "@stripe/react-stripe-js": import_path.default.resolve(__dirname, "src/stubs/react-stripe-js.tsx"),
        "@heroicons/react/24/outline": import_path.default.resolve(__dirname, "src/stubs/heroicons-outline.tsx"),
        "@heroicons/react/24/solid": import_path.default.resolve(__dirname, "src/stubs/heroicons-solid.tsx"),
        "framer-motion": import_path.default.resolve(__dirname, "src/stubs/framer-motion.tsx"),
        "zod": import_path.default.resolve(__dirname, "src/stubs/zod.ts"),
        "ioredis": import_path.default.resolve(__dirname, "src/stubs/ioredis.ts"),
        "croner": import_path.default.resolve(__dirname, "src/stubs/croner.ts"),
        "redis": import_path.default.resolve(__dirname, "src/stubs/redis.ts"),
        "axios": import_path.default.resolve(__dirname, "src/stubs/axios.ts"),
        "https-proxy-agent": import_path.default.resolve(__dirname, "src/stubs/https-proxy-agent.ts"),
        "socks-proxy-agent": import_path.default.resolve(__dirname, "src/stubs/socks-proxy-agent.ts"),
        "puppeteer": import_path.default.resolve(__dirname, "src/stubs/puppeteer.ts")
      };
    }
    return config;
  }
};
var __filename = (0, import_url.fileURLToPath)(import_meta.url);
var __dirname = import_path.default.dirname(__filename);
var next_config_default = nextConfig;
