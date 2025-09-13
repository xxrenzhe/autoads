'use client';

import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, 
  Search, 
  Book, 
  MessageCircle, 
  Mail, 
  ExternalLink,
  ChevronRight,
  Star,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';

interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  helpful: number;
  notHelpful: number;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  popular: boolean;
}

const HelpSystem: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'faq' | 'contact'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HelpArticle[]>([]);
  const [popularFAQs, setPopularFAQs] = useState<FAQ[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);

  // 模拟帮助文章数据
  const helpArticles: HelpArticle[] = [
    {
      id: '1',
      title: '如何开始使用SiteRank功能',
      content: '详细的SiteRank使用指南...',
      category: '功能使用',
      tags: ['siterank', '分析', '入门'],
      helpful: 25,
      notHelpful: 2
    },
    {
      id: '2',
      title: 'Token系统说明',
      content: 'Token的使用方法和计费规则...',
      category: '账户管理',
      tags: ['token', '计费', '订阅'],
      helpful: 18,
      notHelpful: 1
    },
    {
      id: '3',
      title: '批量处理最佳实践',
      content: 'BatchOpen功能的使用技巧...',
      category: '功能使用',
      tags: ['batchopen', '批量', '优化'],
      helpful: 22,
      notHelpful: 3
    }
  ];

  // 模拟常见问题数据
  const faqs: FAQ[] = [
    {
      id: '1',
      question: '忘记密码怎么办？',
      answer: '在登录页面点击"忘记密码"，输入邮箱地址，按照邮件指引重置密码。',
      category: '账户问题',
      popular: true
    },
    {
      id: '2',
      question: 'Token用完了怎么办？',
      answer: '可以等待下月自动重置，或者升级到更高的订阅计划。',
      category: 'Token问题',
      popular: true
    },
    {
      id: '3',
      question: '如何导出分析结果？',
      answer: '在结果页面点击"导出"按钮，选择格式后下载文件。',
      category: '功能使用',
      popular: false
    }
  ];

  useEffect(() => {
    // 获取热门FAQ
    setPopularFAQs(faqs.filter((faq: any) => faq.popular));
  }, []);

  useEffect(() => {
    // 搜索功能
    if (searchQuery.trim()) {
      const results = helpArticles.filter((article: any) =>
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleFeedback = (articleId: string, isHelpful: boolean) => {
    // 处理用户反馈
    console.log(`Article ${articleId} feedback: ${isHelpful ? 'helpful' : 'not helpful'}`);
    // 这里应该发送到后端API
  };

  const HelpButton = () => (
    <button
      onClick={() => setIsOpen(true)}
      className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all duration-200 z-50"
      title="获取帮助"
    >
      <HelpCircle size={24} />
    </button>
  );

  const SearchTab = () => (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="搜索帮助文档..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {searchQuery && (
        <div className="space-y-2">
          <h3 className="font-medium text-gray-900">搜索结果 ({searchResults.length})</h3>
          {searchResults.length > 0 ? (
            <div className="space-y-2">
              {searchResults.map((article) => (
                <div
                  key={article.id}
                  onClick={() => setSelectedArticle(article)}
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <h4 className="font-medium text-gray-900">{article.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {article.content.substring(0, 100)}...
                  </p>
                  <div className="flex items-center mt-2 space-x-2">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {article.category}
                    </span>
                    <div className="flex items-center text-xs text-gray-500">
                      <ThumbsUp size={12} className="mr-1" />
                      {article.helpful}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">未找到相关内容</p>
          )}
        </div>
      )}

      {!searchQuery && (
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">热门文章</h3>
          <div className="space-y-2">
            {helpArticles.slice(0, 3).map((article) => (
              <div
                key={article.id}
                onClick={() => setSelectedArticle(article)}
                className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer flex items-center justify-between"
              >
                <div>
                  <h4 className="font-medium text-gray-900">{article.title}</h4>
                  <p className="text-sm text-gray-600">{article.category}</p>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const FAQTab = () => (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900">常见问题</h3>
      <div className="space-y-3">
        {faqs.map((faq: any) => (
          <details key={faq.id} className="border border-gray-200 rounded-lg">
            <summary className="p-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
              <span className="font-medium text-gray-900">{faq.question}</span>
              {faq.popular && (
                <Star size={16} className="text-yellow-500 fill-current" />
              )}
            </summary>
            <div className="p-3 pt-0 text-gray-600">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>
    </div>
  );

  const ContactTab = () => (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900">联系支持</h3>
      
      <div className="space-y-3">
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center mb-2">
            <Mail className="text-blue-600 mr-2" size={20} />
            <h4 className="font-medium">邮件支持</h4>
          </div>
          <p className="text-sm text-gray-600 mb-2">
            发送邮件给我们，通常在24小时内回复
          </p>
          <a
            href="mailto:support@example.com"
            className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
          >
            support@example.com
            <ExternalLink size={14} className="ml-1" />
          </a>
        </div>

        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center mb-2">
            <MessageCircle className="text-green-600 mr-2" size={20} />
            <h4 className="font-medium">在线客服</h4>
          </div>
          <p className="text-sm text-gray-600 mb-2">
            工作日 9:00-18:00 在线服务
          </p>
          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm">
            开始对话
          </button>
        </div>

        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center mb-2">
            <Book className="text-purple-600 mr-2" size={20} />
            <h4 className="font-medium">用户手册</h4>
          </div>
          <p className="text-sm text-gray-600 mb-2">
            查看完整的用户使用指南
          </p>
          <a
            href="/docs/user-manual"
            target="_blank"
            className="text-purple-600 hover:text-purple-700 text-sm flex items-center"
          >
            查看手册
            <ExternalLink size={14} className="ml-1" />
          </a>
        </div>
      </div>
    </div>
  );

  const ArticleView = () => (
    <div className="space-y-4">
      <button
        onClick={() => setSelectedArticle(null)}
        className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
      >
        ← 返回搜索
      </button>
      
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {selectedArticle?.title}
        </h2>
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
            {selectedArticle?.category}
          </span>
          {selectedArticle?.tags.map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              {tag}
            </span>
          ))}
        </div>
        
        <div className="prose prose-sm max-w-none text-gray-600">
          {selectedArticle?.content}
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-3">这篇文章对您有帮助吗？</p>
          <div className="flex space-x-2">
            <button
              onClick={() => handleFeedback(selectedArticle?.id || '', true)}
              className="flex items-center px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              <ThumbsUp size={14} className="mr-1" />
              有帮助 ({selectedArticle?.helpful})
            </button>
            <button
              onClick={() => handleFeedback(selectedArticle?.id || '', false)}
              className="flex items-center px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              <ThumbsDown size={14} className="mr-1" />
              没帮助 ({selectedArticle?.notHelpful})
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!isOpen) {
    return <HelpButton />;
  }

  return (
    <>
      <HelpButton />
      
      {/* 帮助面板 */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
          {/* 头部 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">帮助中心</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* 标签页 */}
          {!selectedArticle && (
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('search')}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'search'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                搜索帮助
              </button>
              <button
                onClick={() => setActiveTab('faq')}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'faq'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                常见问题
              </button>
              <button
                onClick={() => setActiveTab('contact')}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'contact'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                联系支持
              </button>
            </div>
          )}

          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedArticle ? (
              <ArticleView />
            ) : (
              <>
                {activeTab === 'search' && <SearchTab />}
                {activeTab === 'faq' && <FAQTab />}
                {activeTab === 'contact' && <ContactTab />}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default HelpSystem;
