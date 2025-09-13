/**
 * 代理配置组件
 * 处理代理URL验证、智能策略选择等
 */

import React, { useCallback, useState } from 'react';
import { createClientLogger } from '@/lib/utils/security/client-secure-logger';
import { ProtectedButton } from '@/components/auth/ProtectedButton';

const logger = createClientLogger('ProxyConfig');

// 社交媒体Referer列表（按名称和URL）
const SOCIAL_MEDIA_OPTIONS = [
  { name: "Google", url: "https://www.google.com/" },
  { name: "Facebook", url: "https://www.facebook.com/" },
  { name: "YouTube", url: "https://www.youtube.com/" },
  { name: "WhatsApp", url: "https://www.whatsapp.com/" },
  { name: "Instagram", url: "https://www.instagram.com/" },
  { name: "TikTok", url: "https://www.tiktok.com/" },
  { name: "Messenger", url: "https://www.messenger.com/" },
  { name: "Telegram", url: "https://telegram.org/" },
  { name: "Snapchat", url: "https://www.snapchat.com/" },
  { name: "X (Twitter)", url: "https://x.com/" },
  { name: "LinkedIn", url: "https://www.linkedin.com/" },
  { name: "Pinterest", url: "https://www.pinterest.com/" },
  { name: "Reddit", url: "https://www.reddit.com/" },
  { name: "Quora", url: "https://www.quora.com/" },
  { name: "Tumblr", url: "https://www.tumblr.com/" },
  { name: "Twitch", url: "https://www.twitch.tv/" },
  { name: "Discord", url: "https://discord.com/" }
];

// 获取默认的社交媒体（Facebook）
const DEFAULT_SOCIAL_MEDIA = SOCIAL_MEDIA_OPTIONS[1]; // Facebook

interface ProxyConfigProps {
  proxyUrl: string;
  proxyValidationSuccess: boolean;
  isValidatingProxy: boolean;
  lastValidatedProxyUrl: string | null;
  refererOption: "social" | "custom";
  selectedSocialMedia: string;
  customReferer: string;
  requiredProxyCount: number;
  isOpening: boolean;
  paramErrors: {
    proxyUrl?: string;
    customReferer?: string;
  };
  onProxyUrlChange: (value: string) => void;
  onRefererOptionChange: (value: "social" | "custom") => void;
  onSelectedSocialMediaChange: (value: string) => void;
  onCustomRefererChange: (value: string) => void;
  onValidateProxy: (url: string) => Promise<boolean>;
  setError: (error: string) => void;
  setStatus: (status: string) => void;
  setProxyValidationSuccess: (success: boolean) => void;
  setLastValidatedProxyUrl: (url: string | null) => void;
}

export const ProxyConfig: React.FC<ProxyConfigProps> = ({
  proxyUrl,
  proxyValidationSuccess,
  isValidatingProxy,
  lastValidatedProxyUrl,
  refererOption,
  selectedSocialMedia,
  customReferer,
  requiredProxyCount,
  isOpening,
  paramErrors,
  onProxyUrlChange,
  onRefererOptionChange,
  onSelectedSocialMediaChange,
  onCustomRefererChange,
  onValidateProxy,
  setError,
  setStatus,
  setProxyValidationSuccess,
  setLastValidatedProxyUrl
}) => {
  // 检测代理协议类型
  const detectProxyProtocol = useCallback((url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const proxyTypeParam = urlObj.searchParams.get('proxyType');
      return proxyTypeParam;
    } catch (error) {
      return null as any;
    }
  }, []);

  // 处理代理URL变化
  const handleProxyUrlChange = useCallback((newUrl: string) => {
    onProxyUrlChange(newUrl);
    
    // 清除之前的错误信息
    setError('');
    
    // 只有当URL真正改变时才重置验证状态
    if (newUrl.trim() !== lastValidatedProxyUrl) {
      logger.info('URL已修改，重置验证状态');
      setProxyValidationSuccess(false);
    }
  }, [onProxyUrlChange, lastValidatedProxyUrl, setProxyValidationSuccess, setError]);

  // 处理代理验证
  const handleValidateProxy = useCallback(async () => {
    if (!proxyUrl.trim()) {
      return;
    }
    
    // 验证前检查协议类型，如果是SOCKS则显示错误
    const proxyType = detectProxyProtocol(proxyUrl);
    if (proxyType === 'socks5') {
      setError('❌ 静默版本不支持SOCKS5代理！请使用HTTP代理 (proxyType=http)。\n\n💡 解决方案：\n1. 将URL中的 proxyType=socks5 改为 proxyType=http\n2. 或使用我们提供的SOCKS5转换工具');
      setProxyValidationSuccess(false);
      return;
    } else if (proxyType === 'socks4') {
      setError('❌ 静默版本不支持SOCKS4代理！请使用HTTP代理 (proxyType=http)。\n\n💡 解决方案：\n1. 将URL中的 proxyType=socks4 改为 proxyType=http\n2. 或联系代理服务商获取HTTP代理接口');
      setProxyValidationSuccess(false);
      return;
    }
    
    await onValidateProxy(proxyUrl);
  }, [proxyUrl, onValidateProxy, setError, detectProxyProtocol]);

  return (
    <div className="mb-6">
      {/* 代理IP配置 */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          动态代理IP（URL）
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={proxyUrl}
            onChange={((e: any): any) => handleProxyUrlChange(e.target.value)}
            placeholder="https://api.iprocket.io/api?username=xxx&password=xxx&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt"
            className={`flex-1 p-2 border rounded-lg ${proxyValidationSuccess ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}
            disabled={isOpening}
          />
          <ProtectedButton
            featureName="batchopen"
            onClick={handleValidateProxy}
            disabled={isOpening || !proxyUrl.trim() || isValidatingProxy}
            className={`px-4 py-2 rounded-lg whitespace-nowrap flex items-center gap-2 ${
              isValidatingProxy 
                ? 'bg-blue-400 cursor-not-allowed' 
                : proxyValidationSuccess
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
            } text-white`}
          >
            {isValidatingProxy ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                验证中...
              </>
            ) : proxyValidationSuccess ? (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                验证成功
              </>
            ) : (
              '验证代理'
            )}
          </ProtectedButton>
        </div>
        {paramErrors.proxyUrl && (
          <p className="text-red-500 text-sm mt-1">{paramErrors.proxyUrl}</p>
        )}
        {proxyValidationSuccess && (
          <div className="text-green-600 text-sm mt-1">
            <p>✓ 代理URL验证通过，可以正常获取代理IP</p>
          </div>
        )}
        <div className="text-gray-500 mt-1">
          <p className="text-[11px]">💡 提示：仅支持HTTP/HTTPS代理，不支持SOCKS5代理</p>
          </div>
      </div>

  
  
      {/* Referer配置 */}
      <div>
        <label className="block text-sm font-medium mb-2">自定义Referer</label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              value="social"
              checked={refererOption === "social"}
              onChange={((: any): any) => onRefererOptionChange("social")}
              className="mr-2"
              disabled={isOpening}
            />
            <span className="text-sm">社交媒体来源</span>
          </label>
          {refererOption === "social" && (
            <div className="ml-6 flex items-center gap-2">
              <span className="text-sm whitespace-nowrap">社交媒体</span>
              <select
                value={selectedSocialMedia}
                onChange={((e: any): any) => onSelectedSocialMediaChange(e.target.value)}
                className="flex-1 p-2 border border-gray-300 rounded-lg"
                disabled={isOpening}
              >
                {SOCIAL_MEDIA_OPTIONS.map((option: any) => (
                  <option key={option.url} value={option.url}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <label className="flex items-center">
            <input
              type="radio"
              value="custom"
              checked={refererOption === "custom"}
              onChange={((: any): any) => onRefererOptionChange("custom")}
              className="mr-2"
              disabled={isOpening}
            />
            <span className="text-sm">自定义</span>
          </label>
        </div>
        {refererOption === "custom" && (
          <div className="mt-2">
            <input
              type="text"
              value={customReferer}
              onChange={((e: any): any) => onCustomRefererChange(e.target.value)}
              placeholder="请输入自定义Referer，例如：https://www.google.com/（留空则不发送Referer）"
              className="w-full p-2 border border-gray-300 rounded-lg"
              disabled={isOpening}
            />
            {paramErrors.customReferer && (
              <p className="text-red-500 text-sm mt-1">{paramErrors.customReferer}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              💡 提示：留空则浏览器请求不会发送Referer头
            </p>
          </div>
        )}
      </div>
    </div>
  );
};