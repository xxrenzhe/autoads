#!/usr/bin/env node
/*
  启动前环境变量校验（Next 前端）
  - 校验关键 ENV 是否存在/格式正确
  - 给出可读的告警，不中断启动（返回码 0），适合预发/生产观察
  - 后端（Go）所需的 PUBLIC KEY/端口等无法在此直接校验，仅提示
*/

const required = [
  'AUTH_SECRET',
  'NEXT_PUBLIC_DOMAIN',
  'NEXT_PUBLIC_DEPLOYMENT_ENV',
  'DATABASE_URL',
  'REDIS_URL',
];

const warnOnly = [
  'INTERNAL_JWT_PRIVATE_KEY',
  'INTERNAL_JWT_TTL_SECONDS',
  'INTERNAL_JWT_ISS',
  'INTERNAL_JWT_AUD',
  'BACKEND_URL',
];

function hasPEM(val, kind) {
  if (!val) return false;
  if (kind === 'private') return /BEGIN (RSA )?PRIVATE KEY/.test(val);
  if (kind === 'public') return /BEGIN (RSA )?PUBLIC KEY/.test(val);
  return false;
}

const missing = [];
for (const key of required) {
  if (!process.env[key] || String(process.env[key]).trim() === '') missing.push(key);
}

const warnings = [];
for (const key of warnOnly) {
  if (!process.env[key] || String(process.env[key]).trim() === '') warnings.push(key);
}
if (process.env.INTERNAL_JWT_PRIVATE_KEY && !hasPEM(process.env.INTERNAL_JWT_PRIVATE_KEY, 'private')) {
  warnings.push('INTERNAL_JWT_PRIVATE_KEY 格式可能不正确（期望 PEM）');
}

function out(section, arr) {
  if (arr.length === 0) return;
  console.log(`\n[${section}]`);
  for (const k of arr) console.log(` - ${k}`);
}

console.log('环境变量快速检查（Next 前端）：');
out('缺失 (必须提供)', missing);
out('建议提供 (未设置则按默认/回退策略运行)', warnings);

// 运行环境与端口提示
const env = process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || process.env.NODE_ENV || 'development';
console.log(`\n环境：${env}`);
console.log('提示：');
console.log(' - Go 后端需配置 INTERNAL_JWT_PUBLIC_KEY（PEM），并监听容器内 8080；');
console.log(' - Next 通过 /go/* 仅暴露 3000 端口对外访问，不直接暴露 Go 后端端口。');
console.log(' - 若未设置 BACKEND_URL，则默认代理到 http://127.0.0.1:8080');

// 不阻塞启动
process.exit(0);

