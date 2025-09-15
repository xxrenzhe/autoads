import { AuthProvider } from 'react-admin';
import { useSession } from 'next-auth/react';

interface LoginParams {
  username: string;
  password: string;
}

interface ErrorResponse {
  status?: number;
  message?: string;
}

// 创建一个自定义的 Auth Provider，使用 NextAuth 会话
export const createNextAuthAuthProvider = (): AuthProvider => {
  return {
    login: async ({ username, password }: LoginParams) => {
      // React Admin 的 login 方法不应该被调用，因为我们使用 NextAuth
      // 如果用户到达这里，说明 NextAuth 会话已经过期
      return Promise.reject(new Error('Please use NextAuth for authentication'));
    },

    logout: () => {
      // 清理 NextAuth 会话（后台独立登录页）
      window.location.href = '/ops/console/login?callbackUrl=%2Fops%2Fconsole%2Fpanel';
      return Promise.resolve();
    },

    checkAuth: () => {
      // 由于我们在客户端，无法直接检查 NextAuth 会话
      // 实际的认证检查在 layout.tsx 中进行
      return Promise.resolve();
    },

    checkError: (error: ErrorResponse) => {
      const status = error.status;
      if (status === 401 || status === 403) {
        // 如果 API 返回 401/403，重定向到后台登录
        window.location.href = '/ops/console/login?callbackUrl=%2Fops%2Fconsole%2Fpanel';
        return Promise.reject();
      }
      return Promise.resolve();
    },

    getPermissions: () => {
      // 从 NextAuth 会话获取权限
      // 由于在客户端，我们返回所有管理员权限
      // 根据用户角色返回不同的权限
      const userStr = localStorage.getItem('nextAuthUser');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.role === 'ADMIN') {
          return Promise.resolve([
            'admin',
            'users:read', 'users:write',
            'subscriptions:read', 'subscriptions:write',
            'config:read',
            'payments:read',
            'notifications:read', 'notifications:write',
            'api:read'
          ]);
        }
      }
      
      // 默认返回基本权限
      return Promise.resolve([
        'admin',
        'users:read',
        'subscriptions:read',
        'config:read',
        'payments:read',
        'notifications:read',
        'api:read'
      ]);
    },

    getIdentity: () => {
      // 从 NextAuth 会话获取用户信息
      // 由于在客户端，我们无法直接访问会话信息
      // 我们可以从 localStorage 或全局状态获取
      const userStr = localStorage.getItem('nextAuthUser');
      if (userStr) {
        const user = JSON.parse(userStr);
        return Promise.resolve({
          id: user.id,
          fullName: user.name || user.email,
          avatar: user.image,
        });
      }
      
      // 如果没有找到用户信息，返回默认值
      return Promise.resolve({
        id: 'unknown',
        fullName: 'Admin User',
      });
    },
  };
};

// 创建一个高阶组件来包装 React Admin
export const withNextAuth = (WrappedComponent: React.ComponentType<any>) => {
  return function WithNextAuth(props: any) {
    const { data: session } = useSession();
    
    // 将 NextAuth 用户信息存储到 localStorage，供 Auth Provider 使用
    if (session?.user) {
      localStorage.setItem('nextAuthUser', JSON.stringify(session.user));
    }
    
    return <WrappedComponent {...props} />;
  };
};
