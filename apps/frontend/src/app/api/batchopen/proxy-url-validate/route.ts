import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createLogger } from "@/lib/utils/security/secure-logger";
import { proxyService } from "@/lib/services/proxy-service";
import { withApiProtection } from '@/lib/api-utils';
import { validateInput, proxyUrlSchema } from "@/lib/utils/validation";

const logger = createLogger('ProxyUrlValidationAPI');

// 强制动态渲染
export const dynamic = 'force-dynamic';

// 防止缓存
export const fetchCache = 'force-no-store';

// Handle OPTIONS method for CORS preflight
export async function OPTIONS(request: NextRequest) {
  // Add secure CORS headers
  const origin = request.headers.get('origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000', 'https://autoads.dev'];
  
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);
  const corsOrigin = isAllowedOrigin ? origin : allowedOrigins[0];
  
  const secureHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  
  return new NextResponse(null, {
    status: 200,
    headers: secureHeaders,
  });
}

// Handle other HTTP methods for debugging
const rawGET = async function (request: NextRequest) {
  logger.warn('GET method not allowed for proxy-url-validate');
  
  // Add secure CORS headers
  const origin = request.headers.get('origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000', 'https://autoads.dev'];
  
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);
  const corsOrigin = isAllowedOrigin ? origin : allowedOrigins[0];
  
  const secureHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  
  return NextResponse.json({
    success: false,
    message: 'Method not allowed. Please use POST.'
  }, { 
    status: 405,
    headers: secureHeaders
  });
}

const rawPUT = async function (request: NextRequest) {
  logger.warn('PUT method not allowed for proxy-url-validate');
  
  // Add secure CORS headers
  const origin = request.headers.get('origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000', 'https://autoads.dev'];
  
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);
  const corsOrigin = isAllowedOrigin ? origin : allowedOrigins[0];
  
  const secureHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  
  return NextResponse.json({
    success: false,
    message: 'Method not allowed. Please use POST.'
  }, { 
    status: 405,
    headers: secureHeaders
  });
}

const rawDELETE = async function (request: NextRequest) {
  logger.warn('DELETE method not allowed for proxy-url-validate');
  
  // Add secure CORS headers
  const origin = request.headers.get('origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000', 'https://autoads.dev'];
  
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);
  const corsOrigin = isAllowedOrigin ? origin : allowedOrigins[0];
  
  const secureHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  
  return NextResponse.json({
    success: false,
    message: 'Method not allowed. Please use POST.'
  }, { 
    status: 405,
    headers: secureHeaders
  });
}

export const GET = withApiProtection('batchOpen')(rawGET as any) as any;
export const PUT = withApiProtection('batchOpen')(rawPUT as any) as any;
export const DELETE = withApiProtection('batchOpen')(rawDELETE as any) as any;

async function handlePOST(request: NextRequest) {
  const startTime = Date.now();
  
  // Add secure CORS headers
  const origin = request.headers.get('origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000', 'https://autoads.dev'];
  
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);
  const corsOrigin = isAllowedOrigin ? origin : allowedOrigins[0];
  
  const headers = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  
  try {
    const body = await request.json();
    
    // 验证输入数据
    const inputValidation = validateInput(
      z.object({ proxyUrl: proxyUrlSchema }),
      body
    );
    
    if (!inputValidation.success) {
      logger.warn('输入验证失败', {
        error: inputValidation.error,
        userAgent: request.headers.get('user-agent')
      });
      
      return NextResponse.json({
        success: false,
        message: inputValidation.error,
        code: 'VALIDATION_ERROR'
      }, { 
        status: 400,
        headers 
      });
    }
    
    const { proxyUrl } = inputValidation.data as any;
    
    logger.info('验证代理URL格式和IP获取能力:', { proxyUrl });

    // 使用专门的URL验证（仅验证能否获取代理IP）
    const validationResult = await proxyService.validateProxyUrlFormat(proxyUrl);

    logger.info('代理URL验证完成', {
      proxyUrl,
      isValid: validationResult.isValid,
      error: validationResult.error
    });

    if (validationResult.isValid) {
      // Check if multiple proxies were requested
      const urlObj = new URL(proxyUrl);
      const ipsParam = urlObj.searchParams.get('ips');
      const requestedCount = ipsParam ? parseInt(ipsParam) : 1;
      
      return NextResponse.json({
        success: true,
        message: `代理URL格式正确，成功获取${validationResult.proxies?.length || 0}个代理IP`,
        proxy: {
          url: proxyUrl,
          status: 'valid',
          proxyConfig: requestedCount > 1 ? validationResult.proxies : (validationResult.proxies?.[0] || null),
          proxyCount: validationResult.proxies?.length || 0,
          requestedCount: requestedCount
        }
      }, { headers });
    } else {
      return NextResponse.json({
        success: false,
        message: validationResult.error || '代理URL验证失败',
        code: 'PROXY_URL_VALIDATION_FAILED'
      }, { 
        status: 400,
        headers 
      });
    }

  } catch (error) {
    logger.error('验证代理URL失败', { 
      error: error instanceof Error ? error : new Error(String(error)),
      duration: Date.now() - startTime
    });
    
    return NextResponse.json({
      success: false,
      message: '验证代理URL时发生错误'
    }, { 
      status: 500,
      headers 
    });
  }
}

export const POST = withApiProtection('batchOpen')(handlePOST as any) as any;
