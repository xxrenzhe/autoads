// 统一的UI样式常量
export const UI_CONSTANTS = {
  // 颜色主题
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
    },
    secondary: {
      50: '#f3e8ff',
      100: '#e9d5ff',
      500: '#8b5cf6',
      600: '#7c3aed',
      700: '#6d28d9',
    },
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
    },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      600: '#4b5563',
      700: '#374151',
      900: '#111827',
    },
  },
  
  // 字体大小
  typography: {
    hero: {
      fontSize: 'clamp(4rem, 8vw, 8rem)',
      fontWeight: 'bold',
      lineHeight: '1',
    },
    h1: 'text-3xl md:text-4xl font-bold',
    h2: 'text-2xl md:text-3xl font-bold',
    h3: 'text-xl md:text-2xl font-semibold',
    h4: 'text-lg font-semibold',
    subtitle: 'text-lg text-gray-600',
    body: 'text-base text-gray-600',
    small: 'text-sm text-gray-500',
    caption: 'text-xs text-gray-400',
  },
  
  // 间距
  spacing: {
    section: 'py-12 px-4',
    container: 'max-w-6xl mx-auto',
    card: 'p-8',
    gap: 'gap-8',
  },
  
  // 阴影
  shadows: {
    card: 'shadow-lg',
    hover: 'hover:shadow-xl',
    none: 'shadow-none',
  },
  
  // 圆角
  borderRadius: {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    full: 'rounded-full',
  },
  
  // 渐变背景
  gradients: {
    hero: 'bg-gradient-to-br from-blue-50 via-white to-purple-50',
    primary: 'bg-gradient-to-r from-blue-500 to-blue-600',
    secondary: 'bg-gradient-to-r from-purple-500 to-purple-600',
    success: 'bg-gradient-to-r from-green-500 to-green-600',
    cta: 'bg-gradient-to-r from-blue-600 to-purple-600',
  },
  
  // 动画
  transitions: {
    fast: 'transition-all duration-200',
    normal: 'transition-all duration-300',
    slow: 'transition-all duration-500',
  },
  
  // 按钮样式
  buttons: {
    primary: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 hover:shadow-lg',
    secondary: 'bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-300 hover:shadow-lg',
    success: 'bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 hover:shadow-lg',
    outline: 'border-2 border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-xl hover:bg-gray-50 transition-all duration-300',
    // 供管理后台等危险操作使用（删除/清空等）
    danger: 'bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 hover:shadow-lg',
  },
  
  // 卡片样式
  cards: {
    default: 'bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300',
    featured: 'bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]',
    simple: 'bg-white rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-all duration-300',
  },
} as const;

// 通用的页面布局组件
export const PageLayout = ({ 
  children, 
  title, 
  subtitle 
}: { 
  children: React.ReactNode; 
  title: string; 
  subtitle?: string; 
}) => (
  <div className={`min-h-screen ${UI_CONSTANTS.gradients.hero}`}>
    <div className={UI_CONSTANTS.spacing.container}>
      <div className="text-center mb-12">
        <h1 className={UI_CONSTANTS.typography.h1}>{title}</h1>
        {subtitle && (
          <p className={`${UI_CONSTANTS.typography.subtitle} max-w-3xl mx-auto mt-4`}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  </div>
);

// 通用的卡片组件
export const FeatureCard = ({ 
  icon, 
  title, 
  description, 
  features, 
  action,
  color = 'blue'
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
  features: string[]; 
  action: React.ReactNode;
  color?: 'blue' | 'green' | 'purple' | 'orange';
}) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
    green: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
    purple: 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
    orange: 'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
  };
  
  const dotColor = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };
  
  return (
    <div className={UI_CONSTANTS.cards.featured}>
      <div className={`w-16 h-16 bg-gradient-to-br ${colorClasses[color]} rounded-xl flex items-center justify-center mb-6 hover:scale-110 transition-transform duration-300`}>
        {icon}
      </div>
      <h3 className={UI_CONSTANTS.typography.h3}>{title}</h3>
      <p className={`${UI_CONSTANTS.typography.body} mb-6 leading-relaxed`}>
        {description}
      </p>
      <ul className={`${UI_CONSTANTS.typography.small} mb-8 space-y-2`}>
        {features.map((feature, index: any) => (
          <li key={index} className="flex items-center">
            <div className={`w-1.5 h-1.5 ${dotColor[color]} rounded-full mr-3`}></div>
            {feature}
          </li>
        ))}
      </ul>
      {action}
    </div>
  );
};
