import { NextRequest } from 'next/server';

/**
 * 获取客户端真实IP地址
 * 支持代理服务器和负载均衡器
 */
export function getClientIP(request: NextRequest): string {
  // 按优先级检查可能的IP头
  const ipHeaders = [
    'CF-Connecting-IP', // Cloudflare
    'X-Forwarded-For', // 标准
    'X-Real-IP',       // Nginx
    'X-Client-IP',     // 一些负载均衡器
    'True-Client-IP',  // Cloudflare
    'HTTP_X_FORWARDED_FOR',
    'HTTP_X_REAL_IP',
    'REMOTE_ADDR'
  ];

  for (const header of ipHeaders) {
    const value = request.headers.get(header);
    if (value) {
      // X-Forwarded-For 可能包含多个IP，取第一个
      if (header.toLowerCase() === 'x-forwarded-for') {
        const ips = value.split(',')?.filter(Boolean)?.map((ip: any) => ip.trim());
        if (ips.length > 0 && ips[0]) {
          return ips[0];
        }
      }
      return value;
    }
  }

  // 如果没有找到任何IP头，返回未知
  return 'unknown';
}

/**
 * 获取用户代理
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}

/**
 * IP地址验证
 */
export function isValidIP(ip: string): boolean {
  if (ip === 'unknown' || !ip) return false;
  
  // IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }
  
  // IPv6 (简化版)
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  if (ipv6Regex.test(ip)) {
    return true;
  }
  
  return false;
}

/**
 * 检查是否为私有IP
 */
export function isPrivateIP(ip: string): boolean {
  if (!isValidIP(ip)) return false;
  
  // 私有IP范围
  const privateRanges = [
    /^10\./,                     // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
    /^192\.168\./,                // 192.168.0.0/16
    /^127\./,                     // 127.0.0.0/8
    /^169\.254\./,                // 169.254.0.0/16
    /^::1$/,                      // IPv6 loopback
    /^fc00:/,                     // IPv6 unique local addresses
    /^fe80:/                      // IPv6 link-local addresses
  ];
  
  return privateRanges.some(range => range.test(ip));
}

/**
 * 匿名化IP地址（用于日志）
 */
export function anonymizeIP(ip: string): string {
  if (!isValidIP(ip)) return ip;
  
  if (ip.includes('.')) {
    // IPv4: 192.168.1.100 -> 192.168.1.0
    const parts = ip.split('.');
    parts[3] = '0';
    return parts.join('.');
  } else if (ip.includes(':')) {
    // IPv6: 简化处理，保留前64位
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':') + '::';
  }
  
  return ip;
}