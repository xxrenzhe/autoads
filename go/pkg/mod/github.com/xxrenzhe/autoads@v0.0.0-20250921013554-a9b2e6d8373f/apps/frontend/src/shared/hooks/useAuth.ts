// Simple useAuth hook for testing and basic functionality
export const useAuth = () => {
  return {
    user: { id: 'user1', tenantId: 'tenant1' },
    token: 'mock-token',
    isAuthenticated: true,
    login: async () => {},
    logout: async () => {},
  };
};