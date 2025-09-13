"use client";

import { useEffect } from "react";
import { getClientConfig, initRuntimeConfig } from "@/lib/config/runtime";

// 运行时配置初始化组件
// 这个组件会在页面加载时获取运行时配置并初始化
export default function RuntimeConfigInit() {
  useEffect(() => {
    // 在页面加载时获取配置
    const initializeConfig = async () => {
      try {
        const config = await getClientConfig();
        initRuntimeConfig(config);
        
        // 将配置暴露到全局变量供调试使用
        if (typeof window !== 'undefined') => {
          (window as any).__RUNTIME_CONFIG__ = config;
          (window as any).RUNTIME_CONFIG_DEBUG = {
            timestamp: new Date().toISOString(),
            config,
            source: 'RuntimeConfigInit',
          };
        }
      } catch (error) {
        console.error('Failed to initialize runtime config:', error);
      }
    };

    initializeConfig();
  }, []);

  return null as any;
}