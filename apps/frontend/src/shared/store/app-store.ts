"use client";

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Application configuration
export interface AppConfig {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  features: {
    siterank: boolean;
    batchopen: boolean;
    adscenter: boolean;
    analytics: boolean;
  };
}

// Application metadata
export interface AppMetadata {
  version: string;
  buildDate: string;
  environment: 'development' | 'staging' | 'production';
  apiVersion: string;
}

// Application state interface
export interface AppState {
  // Configuration
  config: AppConfig;
  metadata: AppMetadata;
  
  // Loading states
  isInitializing: boolean;
  isOnline: boolean;
  
  // Error handling
  globalError: string | null;
  
  // Actions
  setConfig: (config: Partial<AppConfig>) => void;
  setTheme: (theme: AppConfig['theme']) => void;
  setLanguage: (language: string) => void;
  setOnlineStatus: (isOnline: boolean) => void;
  setGlobalError: (error: string | null) => void;
  setInitializing: (isInitializing: boolean) => void;
  resetApp: () => void;
}

// Default configuration
const defaultConfig: AppConfig = {
  theme: 'system',
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: 'MM/dd/yyyy',
  currency: 'USD',
  features: {
    siterank: true,
    batchopen: true,
    adscenter: true,
    analytics: true
  }
};

// Default metadata
const defaultMetadata: AppMetadata = {
  version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  buildDate: process.env.NEXT_PUBLIC_BUILD_DATE || new Date().toISOString(),
  environment: (process.env.NODE_ENV as AppMetadata['environment']) || 'development',
  apiVersion: process.env.NEXT_PUBLIC_API_VERSION || 'v1'
};

// Create the app store
export const useAppStore = (create as unknown as <S>() => any)<AppState>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // Initial state
          config: defaultConfig,
          metadata: defaultMetadata,
          isInitializing: true,
          isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
          globalError: null,

          // Actions
          setConfig: (newConfig) =>
            set((state) => {
              state.config = { ...state.config, ...newConfig };
            }),

          setTheme: (theme) =>
            set((state) => {
              state.config.theme = theme;
            }),

          setLanguage: (language) =>
            set((state) => {
              state.config.language = language;
            }),

          setOnlineStatus: (isOnline) =>
            set((state) => {
              state.isOnline = isOnline;
            }),

          setGlobalError: (error) =>
            set((state) => {
              state.globalError = error;
            }),

          setInitializing: (isInitializing) =>
            set((state) => {
              state.isInitializing = isInitializing;
            }),

          resetApp: () =>
            set((state) => {
              state.config = defaultConfig;
              state.globalError = null;
              state.isInitializing = false;
            })
        }))
      ),
      {
        name: 'app-store',
        partialize: (state) => ({
          config: state.config
        })
      }
    ),
    {
      name: 'app-store'
    }
  )
);

// Selectors
export const selectTheme = (state: AppState) => state.config.theme;
export const selectLanguage = (state: AppState) => state.config.language;
export const selectFeatures = (state: AppState) => state.config.features;
export const selectIsOnline = (state: AppState) => state.isOnline;
export const selectGlobalError = (state: AppState) => state.globalError;

// Subscribe to online/offline events
if (typeof window !== 'undefined') {
  const handleOnline = () => useAppStore.getState().setOnlineStatus(true);
  const handleOffline = () => useAppStore.getState().setOnlineStatus(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
}

// Theme change handler
useAppStore.subscribe(
  (state) => state.config.theme,
  (theme) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        // System theme
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    }
  }
);
