"use client";

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// User profile interface
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  phone?: string;
  timezone: string;
  language: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// User preferences
export interface UserPreferences {
  notifications: {
    email: boolean;
    push: boolean;
    desktop: boolean;
  };
  dashboard: {
    layout: 'grid' | 'list';
    density: 'compact' | 'comfortable' | 'spacious';
    defaultModule: 'siterank' | 'batchopen' | 'adscenter' | 'dashboard';
  };
  privacy: {
    profileVisibility: 'public' | 'private';
    activityTracking: boolean;
    analyticsOptOut: boolean;
  };
}

// User session information
export interface UserSession {
  token: string;
  refreshToken: string;
  expiresAt: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
}

// Authentication state
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// User state interface
export interface UserState {
  // User data
  profile: UserProfile | null;
  preferences: UserPreferences | null;
  session: UserSession | null;
  
  // Authentication state
  auth: AuthState;
  
  // Actions
  setProfile: (profile: UserProfile | null) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  setPreferences: (preferences: UserPreferences) => void;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  setSession: (session: UserSession | null) => void;
  setAuthState: (auth: Partial<AuthState>) => void;
  login: (profile: UserProfile, session: UserSession) => void;
  logout: () => void;
  clearError: () => void;
}

// Default preferences
const defaultPreferences: UserPreferences = {
  notifications: {
    email: true,
    push: true,
    desktop: true
  },
  dashboard: {
    layout: 'grid',
    density: 'comfortable',
    defaultModule: 'dashboard'
  },
  privacy: {
    profileVisibility: 'private',
    activityTracking: true,
    analyticsOptOut: false
  }
};

// Create the user store
export const useUserStore = create<UserState>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // Initial state
          profile: null,
          preferences: null,
          session: null,
          auth: {
            isAuthenticated: false,
            isLoading: false,
            error: null
          },

          // Actions
          setProfile: (profile) =>
            set((state) => {
              state.profile = profile;
              state.auth.isAuthenticated = !!profile;
            }),

          updateProfile: (updates) =>
            set((state) => {
              if (state.profile) {
                state.profile = { ...state.profile, ...updates, updatedAt: new Date() };
              }
            }),

          setPreferences: (preferences) =>
            set((state) => {
              state.preferences = preferences;
            }),

          updatePreferences: (updates) =>
            set((state) => {
              if (state.preferences) {
                state.preferences = { ...state.preferences, ...updates };
              } else {
                state.preferences = { ...defaultPreferences, ...updates };
              }
            }),

          setSession: (session) =>
            set((state) => {
              state.session = session;
            }),

          setAuthState: (auth) =>
            set((state) => {
              state.auth = { ...state.auth, ...auth };
            }),

          login: (profile, session) =>
            set((state) => {
              state.profile = profile;
              state.session = session;
              state.preferences = state.preferences || defaultPreferences;
              state.auth = {
                isAuthenticated: true,
                isLoading: false,
                error: null
              };
            }),

          logout: () =>
            set((state) => {
              state.profile = null;
              state.session = null;
              state.auth = {
                isAuthenticated: false,
                isLoading: false,
                error: null
              };
              // Keep preferences for next login
            }),

          clearError: () =>
            set((state) => {
              state.auth.error = null;
            })
        }))
      ),
      {
        name: 'user-store',
        partialize: (state) => ({
          profile: state.profile,
          preferences: state.preferences,
          session: state.session
        })
      }
    ),
    {
      name: 'user-store'
    }
  )
);

// Selectors
export const selectProfile = (state: UserState) => state.profile;
export const selectPreferences = (state: UserState) => state.preferences;
export const selectSession = (state: UserState) => state.session;
export const selectAuthState = (state: UserState) => state.auth;
export const selectIsAuthenticated = (state: UserState) => state.auth.isAuthenticated;
export const selectIsLoading = (state: UserState) => state.auth.isLoading;

// Session expiry checker
if (typeof window !== 'undefined') {
  setInterval(() => {
    const state = useUserStore.getState();
    if (state.session && new Date() > new Date(state.session.expiresAt)) {
      state.logout();
    }
  }, 60000); // Check every minute
}

// Activity tracker
if (typeof window !== 'undefined') {
  useUserStore.subscribe(
    (state) => state.auth.isAuthenticated,
    (isAuthenticated) => {
      if (isAuthenticated) {
        const updateActivity = () => {
          const state = useUserStore.getState();
          if (state.session) {
            state.setSession({
              ...state.session,
              lastActivity: new Date()
            });
          }
        };

        // Update activity on user interactions
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        events.forEach(event => {
          document.addEventListener(event, updateActivity, { passive: true });
        });

        return () => {
          events.forEach(event => {
            document.removeEventListener(event, updateActivity);
          });
        };
      }
      return () => {}; // Always return a cleanup function
    }
  );
}