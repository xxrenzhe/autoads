"use client";

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Modal state
export interface ModalState {
  id: string;
  isOpen: boolean;
  component?: React.ComponentType<any>;
  props?: Record<string, any>;
  options?: {
    closable?: boolean;
    backdrop?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  };
}

// Sidebar state
export interface SidebarState {
  isOpen: boolean;
  isCollapsed: boolean;
  width: number;
  activeSection?: string;
}

// Loading state
export interface LoadingState {
  global: boolean;
  components: Record<string, boolean>;
}

// Breadcrumb item
export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: string;
}

// Page state
export interface PageState {
  title: string;
  subtitle?: string;
  breadcrumbs: BreadcrumbItem[];
  actions?: React.ReactNode;
}

// Layout configuration
export interface LayoutConfig {
  headerHeight: number;
  sidebarWidth: number;
  sidebarCollapsedWidth: number;
  footerHeight: number;
  containerMaxWidth: string;
}

// UI state interface
export interface UIState {
  // Modal management
  modals: ModalState[];
  
  // Sidebar state
  sidebar: SidebarState;
  
  // Loading states
  loading: LoadingState;
  
  // Page state
  page: PageState;
  
  // Layout configuration
  layout: LayoutConfig;
  
  // Responsive breakpoints
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  
  // Actions
  openModal: (id: string, component?: React.ComponentType<any>, props?: Record<string, any>, options?: ModalState['options']) => void;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
  
  setSidebarOpen: (isOpen: boolean) => void;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setActiveSection: (section: string) => void;
  
  setGlobalLoading: (loading: boolean) => void;
  setComponentLoading: (component: string, loading: boolean) => void;
  clearComponentLoading: () => void;
  
  setPageTitle: (title: string) => void;
  setPageSubtitle: (subtitle: string) => void;
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void;
  setPageActions: (actions: React.ReactNode) => void;
  setPageState: (state: Partial<PageState>) => void;
  
  updateLayout: (config: Partial<LayoutConfig>) => void;
  setBreakpoints: (isMobile: boolean, isTablet: boolean, isDesktop: boolean) => void;
}

// Default layout configuration
const defaultLayout: LayoutConfig = {
  headerHeight: 64,
  sidebarWidth: 256,
  sidebarCollapsedWidth: 64,
  footerHeight: 48,
  containerMaxWidth: '1200px'
};

// Default page state
const defaultPageState: PageState = {
  title: '',
  subtitle: '',
  breadcrumbs: []
};

// Create the UI store
export const useUIStore = create<UIState>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // Initial state
          modals: [],
          sidebar: {
            isOpen: true,
            isCollapsed: false,
            width: defaultLayout.sidebarWidth,
            activeSection: undefined
          },
          loading: {
            global: false,
            components: {}
          },
          page: defaultPageState,
          layout: defaultLayout,
          isMobile: false,
          isTablet: false,
          isDesktop: true,

          // Modal actions
          openModal: (id, component, props, options) =>
            set((state: any) => {
              // Close existing modal with same ID
              const existingIndex = state.modals.findIndex(m => m.id === id);
              if (existingIndex !== -1) {
                state.modals.splice(existingIndex, 1);
              }

              // Add new modal
              state.modals.push({
                id,
                isOpen: true,
                component,
                props,
                options
              });
            }),

          closeModal: (id) =>
            set((state: any) => {
              const modal = state.modals.find((m: any) => m.id === id);
              if (modal) {
                modal.isOpen = false;
              }
              // Remove closed modals after animation
              setTimeout(() => {
                const currentState = get();
                set((state: any) => {
                  state.modals = state.modals.filter((m: any) => m.id !== id);
                });
              }, 300);
            }),

          closeAllModals: () =>
            set((state: any) => {
              state.modals.forEach((modal: any) => {
                modal.isOpen = false;
              });
              // Clear all modals after animation
              setTimeout(() => {
                set((state: any) => {
                  state.modals = [];
                });
              }, 300);
            }),

          // Sidebar actions
          setSidebarOpen: (isOpen) =>
            set((state: any) => {
              state.sidebar.isOpen = isOpen;
            }),

          setSidebarCollapsed: (isCollapsed) =>
            set((state: any) => {
              state.sidebar.isCollapsed = isCollapsed;
              state.sidebar.width = isCollapsed 
                ? state.layout.sidebarCollapsedWidth 
                : state.layout.sidebarWidth;
            }),

          setSidebarWidth: (width) =>
            set((state: any) => {
              state.sidebar.width = width;
            }),

          setActiveSection: (section) =>
            set((state: any) => {
              state.sidebar.activeSection = section;
            }),

          // Loading actions
          setGlobalLoading: (loading) =>
            set((state: any) => {
              state.loading.global = loading;
            }),

          setComponentLoading: (component, loading) =>
            set((state: any) => {
              if (loading) {
                state.loading.components[component] = true;
              } else {
                delete state.loading.components[component];
              }
            }),

          clearComponentLoading: () =>
            set((state: any) => {
              state.loading.components = {};
            }),

          // Page actions
          setPageTitle: (title) =>
            set((state: any) => {
              state.page.title = title;
            }),

          setPageSubtitle: (subtitle) =>
            set((state: any) => {
              state.page.subtitle = subtitle;
            }),

          setBreadcrumbs: (breadcrumbs) =>
            set((state: any) => {
              state.page.breadcrumbs = breadcrumbs;
            }),

          setPageActions: (actions) =>
            set((state: any) => {
              state.page.actions = actions;
            }),

          setPageState: (pageState) =>
            set((state: any) => {
              state.page = { ...state.page, ...pageState };
            }),

          // Layout actions
          updateLayout: (config) =>
            set((state: any) => {
              state.layout = { ...state.layout, ...config };
            }),

          setBreakpoints: (isMobile, isTablet, isDesktop) =>
            set((state: any) => {
              state.isMobile = isMobile;
              state.isTablet = isTablet;
              state.isDesktop = isDesktop;
              
              // Auto-collapse sidebar on mobile
              if (isMobile && state.sidebar.isOpen) {
                state.sidebar.isOpen = false;
              }
            })
        }))
      ),
      {
        name: 'ui-store',
        partialize: (state: any) => ({
          sidebar: {
            isCollapsed: state.sidebar.isCollapsed,
            width: state.sidebar.width
          },
          layout: state.layout
        })
      }
    ),
    {
      name: 'ui-store'
    }
  )
);

// Selectors
export const selectModals = (state: UIState) => state.modals;
export const selectOpenModals = (state: UIState) => state.modals.filter((m: any) => m.isOpen);
export const selectSidebar = (state: UIState) => state.sidebar;
export const selectLoading = (state: UIState) => state.loading;
export const selectGlobalLoading = (state: UIState) => state.loading.global;
export const selectPageState = (state: UIState) => state.page;
export const selectLayout = (state: UIState) => state.layout;
export const selectBreakpoints = (state: UIState) => ({
  isMobile: state.isMobile,
  isTablet: state.isTablet,
  isDesktop: state.isDesktop
});

// Responsive breakpoint detection
if (typeof window !== 'undefined') {
  const updateBreakpoints = () => {
    const width = window.innerWidth;
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const isDesktop = width >= 1024;
    
    useUIStore.getState().setBreakpoints(isMobile, isTablet, isDesktop);
  };

  // Initial check
  updateBreakpoints();

  // Listen for resize events
  window.addEventListener('resize', updateBreakpoints);
}

// Keyboard shortcuts
if (typeof window !== 'undefined') {
  document.addEventListener('keydown', (event) => {
    const state = useUIStore.getState();
    
    // ESC to close modals
    if (event.key === 'Escape' && state.modals.length > 0) {
      const topModal = state.modals[state.modals.length - 1];
      if (topModal.options?.closable !== false) {
        state.closeModal(topModal.id);
      }
    }
    
    // Ctrl/Cmd + B to toggle sidebar
    if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
      event.preventDefault();
      state.setSidebarCollapsed(!state.sidebar.isCollapsed);
    }
  });
}