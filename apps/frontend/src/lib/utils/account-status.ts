
/**
 * 统一的账户状态判断工具
 * 避免同时使用 status 和 isActive 字段造成的不一致
 */

export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BANNED';

export interface AccountStatusInfo {
  status: AccountStatus;
  isActive: boolean;
  displayText: string;
  color: string;
  description: string;
}

/**
 * 获取账户状态信息
 * 统一使用 status 字段作为状态源
 */
export function getAccountStatus(user: { status: string }): AccountStatusInfo {
  const status = user.status as AccountStatus;
  
  switch (status) {
    case 'ACTIVE':
      return {
        status,
        isActive: true,
        displayText: '账户正常',
        color: 'text-green-600',
        description: '账户正常，可以使用所有功能'
      };
      
    case 'INACTIVE':
      return {
        status,
        isActive: false,
        displayText: '账户未激活',
        color: 'text-gray-600',
        description: '账户尚未激活，请检查邮箱验证邮件'
      };
      
    case 'SUSPENDED':
      return {
        status,
        isActive: false,
        displayText: '账户已暂停',
        color: 'text-yellow-600',
        description: '账户因违规或其他原因被暂停使用'
      };
      
    case 'BANNED':
      return {
        status,
        isActive: false,
        displayText: '账户已封禁',
        color: 'text-red-600',
        description: '账户因严重违规被永久封禁'
      };
      
    default:
      // 处理未知状态，默认视为未激活
      return {
        status: 'INACTIVE' as AccountStatus,
        isActive: false,
        displayText: '状态异常',
        color: 'text-gray-600',
        description: '账户状态异常，请联系管理员'
      };
  }
}

/**
 * 判断账户是否活跃
 * 替代直接使用 user.status === 'ACTIVE'
 */
export function isAccountActive(user: { status: string }): boolean {
  return getAccountStatus(user).isActive;
}

/**
 * 判断账户是否可以登录
 */
export function canAccountLogin(user: { status: string }): boolean {
  return user.status === 'ACTIVE' || user.status === 'INACTIVE';
}

/**
 * 判断账户是否有功能使用权限
 */
export function hasAccountPermission(user: { status: string }): boolean {
  return user.status === 'ACTIVE';
}

/**
 * 获取状态对应的徽章颜色
 * 用于UI显示
 */
export function getStatusBadgeVariant(status: AccountStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'INACTIVE':
      return 'secondary';
    case 'SUSPENDED':
      return 'outline';
    case 'BANNED':
      return 'destructive';
    default:
      return 'secondary';
  }
}

/**
 * 统一的状态更新函数
 * 确保更新 status 时同步更新 isActive
 */
export async function updateAccountStatus(
  userId: string, 
  newStatus: AccountStatus,
  updateFn: (userId: string, data: any) => Promise<any>
): Promise<void> {
  const statusInfo = getAccountStatus({ status: newStatus });
  
  // 同时更新 status 和 isActive
  await updateFn(userId, {
    status: newStatus,
    isActive: statusInfo.isActive
  });
}
