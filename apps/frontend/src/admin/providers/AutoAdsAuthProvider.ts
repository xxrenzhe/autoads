import { AuthProvider } from 'react-admin';
import { apiClient } from '../../shared/lib/api-client';

interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  role: string;
  status: string;
  emailVerified: boolean;
}

interface LoginParams {
  username: string;
  password: string;
}

interface ErrorResponse {
  status?: number;
  message?: string;
}

export const autoAdsAuthProvider: AuthProvider = {
  login: async ({ username, password }: LoginParams) => {
    try {
      const response = await apiClient.post('/auth/login', { email: username, password });
      const { user, token } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      return Promise.resolve();
    } catch (error: unknown) {
      return Promise.reject(error);
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return Promise.resolve();
  },

  checkAuth: () => {
    const token = localStorage.getItem('token');
    return token ? Promise.resolve() : Promise.reject();
  },

  checkError: (error: ErrorResponse) => {
    const status = error.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return Promise.reject();
    }
    return Promise.resolve();
  },

  getPermissions: () => {
    const user = localStorage.getItem('user');
    if (!user) return Promise.resolve([]);
    
    const parsedUser = JSON.parse(user);
    return Promise.resolve(parsedUser.permissions || []);
  },

  getIdentity: () => {
    const user = localStorage.getItem('user');
    if (!user) return Promise.reject();
    
    const parsedUser: User = JSON.parse(user);
    return Promise.resolve({
      id: parsedUser.id,
      fullName: parsedUser.name || parsedUser.email,
      avatar: parsedUser.image,
    });
  },
};
