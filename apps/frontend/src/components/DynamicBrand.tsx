"use client";

import { useEffect, useState } from 'react';
import { DOMAIN_CONFIG } from '@/lib/domain-config';

interface DynamicBrandProps {
  children: (brandInfo: {
    name: string;
    emailDomain: string;
    isLegacy: boolean;
    isPrimary: boolean;
  }) => React.ReactNode;
}

export const DynamicBrand: React.FC<DynamicBrandProps> = ({ children }) => {
  const [brandInfo, setBrandInfo] = useState({
    name: 'AutoAds.dev',
    emailDomain: 'autoads.dev',
    isLegacy: false,
    isPrimary: true,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') => {
      const hostname = window.location.hostname;
      
      const isLegacy = DOMAIN_CONFIG.isLegacyDomain(hostname);
      const isPrimary = DOMAIN_CONFIG.isPrimaryDomain(hostname);
      
      setBrandInfo({
        name: DOMAIN_CONFIG.getBrandName(hostname),
        emailDomain: DOMAIN_CONFIG.getEmailDomain(hostname),
        isLegacy,
        isPrimary,
      });
    }
  }, []);

  return (
    <>
      {children(brandInfo)}
    </>
  );
};

// Helper hook for accessing brand info directly
export const useBrandInfo = () => {
  const [brandInfo, setBrandInfo] = useState({
    name: 'AutoAds.dev',
    emailDomain: 'autoads.dev',
    isLegacy: false,
    isPrimary: true,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') => {
      const hostname = window.location.hostname;
      
      if (DOMAIN_CONFIG.isSupportedDomain(hostname)) => {
        setBrandInfo({
          name: DOMAIN_CONFIG.getBrandName(hostname),
          emailDomain: DOMAIN_CONFIG.getEmailDomain(hostname),
          isLegacy: DOMAIN_CONFIG.isLegacyDomain(hostname),
          isPrimary: DOMAIN_CONFIG.isPrimaryDomain(hostname),
        });
      }
    }
  }, []);

  return brandInfo;
};