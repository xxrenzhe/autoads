/**
 * 管理员文档导航页面
 * 提供管理员文档的搜索和导航功能
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DocumentSection {
  id: string;
  title: string;
  description: string;
  icon: string;
  path: string;
  tags: string[];
  lastUpdated: string;
}

const DOCUMENT_SECTIONS: DocumentSection[] = [
  {
    id: 'system-config',
    title: '系统配置指南',
    description: '完整的系统配置和初始设置指南，包括环境配置、数据库设置、缓存配置等。',
    icon: '⚙️',
    path: '/docs/admin/system-configuration',
    tags: ['配置', '设置', '环境', '数据库', '缓存'],
    lastUpdated: '2024-12-01'
  },
  {
    id: 'user-management',
    title: '用户管理教程',
    description: '详细的用户管理操作指南，包括用户创建、编辑、权限管理和行为分析。',
    icon: '👥',
    path: '/docs/admin/user-management',
    tags: ['用户', '权限', '管理', '分析'],
    lastUpdated: '2024-12-01'
  },
  {
    id: 'troubleshooting',
    title: '故障排除手册',
    description: '常见问题的诊断和解决方案，包括系统故障、性能问题和安全事件处理。',
    icon: '🔧',
    path: '/docs/admin/troubleshooting',
    tags: ['故障', '问题', '诊断', '修复', '性能'],
    lastUpdated: '2024-12-01'
  },
  {
    id: 'best-practices',
    title: '最佳实践指南',
    description: '系统管理的最佳实践，包括安全管理、性能优化、数据管理和合规性要求。',
    icon: '⭐',
    path: '/docs/admin/best-practices',
    tags: ['最佳实践', '安全', '优化', '合规'],
    lastUpdated: '2024-12-01'
  },
  {
    id: 'api-docs',
    title: 'API 文档',
    description: '完整的 API 文档和使用示例，包括认证、端点说明和 SDK 使用指南。',
    icon: '📡',
    path: '/docs/api',
    tags: ['API', '接口', '开发', '集成'],
    lastUpdated: '2024-12-01'
  }
];

const QUICK_LINKS = [
  { title: '快速开始', path: '/docs/admin/quick-start', icon: '🚀' },
  { title: '安全检查清单', path: '/docs/admin/security-checklist', icon: '🔒' },
  { title: '性能监控', path: '/admin/monitoring', icon: '📊' },
  { title: '系统状态', path: '/admin/system-health', icon: '💚' },
  { title: '用户管理', path: '/admin/users', icon: '👤' },
  { title: '配置管理', path: '/admin/config', icon: '⚙️' }
];

export default function AdminDocsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSections, setFilteredSections] = useState(DOCUMENT_SECTIONS);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // 获取所有标签
  const allTags = Array.from(
    new Set(DOCUMENT_SECTIONS.flatMap(section => section.tags))
  ).sort();

  // 搜索和筛选逻辑
  useEffect(() => {
    let filtered = DOCUMENT_SECTIONS;

    // 文本搜索
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(section =>
        section.title.toLowerCase().includes(query) ||
        section.description.toLowerCase().includes(query) ||
        section.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // 标签筛选
    if (selectedTags.length > 0) {
      filtered = filtered.filter(section =>
        selectedTags.every(tag => section.tags.includes(tag))
      );
    }

    setFilteredSections(filtered);
  }, [searchQuery, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8">
            <h1 className="text-3xl font-bold text-gray-900">管理员文档中心</h1>
            <p className="mt-2 text-lg text-gray-600">
              ChangeLink AutoAds 系统管理指南和最佳实践
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* 侧边栏 */}
          <div className="lg:col-span-1">
            {/* 搜索框 */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">搜索文档</h3>
              <input
                type="text"
                placeholder="搜索文档内容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 标签筛选 */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">按标签筛选</h3>
              <div className="flex flex-wrap gap-2">
                {allTags?.filter(Boolean)?.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-800"
                >
                  清除筛选
                </button>
              )}
            </div>

            {/* 快速链接 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">快速链接</h3>
              <div className="space-y-2">
                {QUICK_LINKS?.filter(Boolean)?.map(link => (
                  <Link
                    key={link.path}
                    href={link.path}
                    className="flex items-center p-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    <span className="mr-3">{link.icon}</span>
                    {link.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* 主内容区 */}
          <div className="lg:col-span-3">
            {/* 搜索结果统计 */}
            {(searchQuery || selectedTags.length > 0) && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800">
                  找到 {filteredSections.length} 个文档
                  {searchQuery && ` 包含 "${searchQuery}"`}
                  {selectedTags.length > 0 && ` 标签: ${selectedTags.join(', ')}`}
                </p>
              </div>
            )}

            {/* 文档卡片网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredSections?.filter(Boolean)?.map(section => (
                <Link
                  key={section.id}
                  href={section.path}
                  className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex items-start">
                      <div className="text-3xl mr-4">{section.icon}</div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          {section.title}
                        </h3>
                        <p className="text-gray-600 mb-4 line-clamp-3">
                          {section.description}
                        </p>
                        
                        {/* 标签 */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {section.tags.slice(0, 3)?.filter(Boolean)?.map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                          {section.tags.length > 3 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                              +{section.tags.length - 3}
                            </span>
                          )}
                        </div>

                        {/* 更新时间 */}
                        <div className="text-sm text-gray-500">
                          最后更新: {section.lastUpdated}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* 无搜索结果 */}
            {filteredSections.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  没有找到匹配的文档
                </h3>
                <p className="text-gray-600 mb-4">
                  尝试调整搜索关键词或清除筛选条件
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedTags([]);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  重置搜索
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 底部帮助信息 */}
        <div className="mt-12 bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl mb-2">💬</div>
              <h4 className="font-medium text-gray-900 mb-2">需要帮助？</h4>
              <p className="text-sm text-gray-600 mb-3">
                如果您在文档中找不到答案，可以联系我们的技术支持团队。
              </p>
              <a
                href="mailto:support@autoads.dev"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                联系支持 →
              </a>
            </div>

            <div className="text-center">
              <div className="text-2xl mb-2">🎥</div>
              <h4 className="font-medium text-gray-900 mb-2">视频教程</h4>
              <p className="text-sm text-gray-600 mb-3">
                观看我们的视频教程，快速掌握系统管理技巧。
              </p>
              <a
                href="/docs/videos"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                观看教程 →
              </a>
            </div>

            <div className="text-center">
              <div className="text-2xl mb-2">💡</div>
              <h4 className="font-medium text-gray-900 mb-2">改进建议</h4>
              <p className="text-sm text-gray-600 mb-3">
                帮助我们改进文档，提交您的建议和反馈。
              </p>
              <a
                href="/docs/feedback"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                提交反馈 →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}