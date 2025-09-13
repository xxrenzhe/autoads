'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, AlertTriangle, CheckCircle, Info, ExternalLink, Globe, Settings, Clock, Users, Zap, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';

export default function ConfigInfoPage() {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link href="/adscenter/setup">
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                返回设置页面
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">ChangeLink 系统配置文档</h1>
            </div>
          </div>
          <p className="text-gray-600">
            详细说明 ChangeLink 系统设置页面中每个配置参数的含义、获取方式和使用注意事项。
          </p>
        </div>

        {/* Table of Contents */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>目录</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-3">基础配置</h3>
                <ul className="space-y-2">
                  <li>
                    <button 
                      onClick={() => scrollToSection('google-ads')}
                      className="text-blue-600 hover:text-blue-800 text-left w-full"
                    >
                      Google Ads 账号配置
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => scrollToSection('affiliate-links')}
                      className="text-blue-600 hover:text-blue-800 text-left w-full"
                    >
                      广告联盟链接配置
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => scrollToSection('adspower')}
                      className="text-blue-600 hover:text-blue-800 text-left w-full"
                    >
                      AdsPower 环境配置
                    </button>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-3">高级配置</h3>
                <ul className="space-y-2">
                  <li>
                    <button 
                      onClick={() => scrollToSection('execution-config')}
                      className="text-blue-600 hover:text-blue-800 text-left w-full"
                    >
                      执行配置创建
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => scrollToSection('automation')}
                      className="text-blue-600 hover:text-blue-800 text-left w-full"
                    >
                      自动化任务设置
                    </button>
                  </li>
                  <li>
                    <button 
                      onClick={() => scrollToSection('verification')}
                      className="text-blue-600 hover:text-blue-800 text-left w-full"
                    >
                      系统验证测试
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* Google Ads 账号配置 */}
          <section id="google-ads" className="scroll-mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-600" />
                  Google Ads 账号配置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-blue-800">
                    Google Ads 账号配置用于授权系统访问和管理您的 Google Ads 账户，包括获取广告数据、更新广告链接等操作。
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">1. 账号名称 *</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>给 Google Ads 账号起的易于识别的名称</li>
                      <li><strong>格式：</strong>自定义文本，建议使用有意义的名称</li>
                      <li><strong>示例：</strong>"主账号"、"品牌推广账号"</li>
                      <li><strong>获取方式：</strong>用户自定义</li>
                      <li><strong>注意事项：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>名称应具有辨识度，便于在多个账号间区分</li>
                          <li>建议包含账号用途或特征信息</li>
                        </ul>
                      </li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">2. Customer ID *</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>Google Ads 账号的唯一标识符</li>
                      <li><strong>格式：</strong>123-456-7890（三组数字，用连字符连接）</li>
                      <li><strong>示例：</strong>"123-456-7890"</li>
                      <li><strong>获取方式：</strong>
                        <ol className="list-decimal list-inside mt-1 ml-4">
                          <li>登录 Google Ads 账号</li>
                          <li>点击右下角的账号信息</li>
                          <li>查看"客户 ID"字段</li>
                          <li>或在账号设置页面查看</li>
                        </ol>
                      </li>
                      <li><strong>注意事项：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>输入时需包含连字符</li>
                          <li>确保使用正确的账号 ID，避免误操作其他账号</li>
                        </ul>
                      </li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">3. Client ID *</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>OAuth 2.0 客户端 ID，用于 API 认证</li>
                      <li><strong>格式：</strong>类似 xxxxx.apps.googleusercontent.com</li>
                      <li><strong>示例：</strong>"123456789-abc123def456.apps.googleusercontent.com"</li>
                      <li><strong>获取方式：</strong>
                        <ol className="list-decimal list-inside mt-1 ml-4">
                          <li>访问 <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a></li>
                          <li>选择或创建项目</li>
                          <li>导航到"API 和服务" &gt; "凭据"</li>
                          <li>创建 OAuth 2.0 客户端 ID</li>
                          <li>选择应用类型为"Web 应用"</li>
                          <li>添加授权的重定向 URI</li>
                        </ol>
                      </li>
                      <li><strong>注意事项：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>必须配置正确的重定向 URI</li>
                          <li>确保已启用 Google Ads API</li>
                        </ul>
                      </li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">4. Client Secret *</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>OAuth 2.0 客户端密钥，用于 API 认证</li>
                      <li><strong>格式：</strong>随机生成的字符串</li>
                      <li><strong>获取方式：</strong>
                        <ol className="list-decimal list-inside mt-1 ml-4">
                          <li>在 Google Cloud Console 的凭据页面</li>
                          <li>点击已创建的 OAuth 2.0 客户端 ID</li>
                          <li>下载客户端密钥或复制密钥值</li>
                          <li><strong>重要：</strong>密钥只在创建时显示一次，请妥善保存</li>
                        </ol>
                      </li>
                      <li><strong>注意事项：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>此为敏感信息，请妥善保管</li>
                          <li>建议定期轮换密钥</li>
                          <li>不要在前端代码中暴露</li>
                        </ul>
                      </li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">5. Developer Token *</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>Google Ads API 开发者令牌</li>
                      <li><strong>格式：</strong>长字符串，通常包含字母和数字</li>
                      <li><strong>示例：</strong>"ABcdeFG1234567"</li>
                      <li><strong>获取方式：</strong>
                        <ol className="list-decimal list-inside mt-1 ml-4">
                          <li>访问 <a href="https://developers.google.com/google-ads/api/docs/start" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Ads API 开发者文档</a></li>
                          <li>申请基本开发者访问权限</li>
                          <li>等待审核通过（通常需要 1-2 个工作日）</li>
                          <li>获取开发者令牌</li>
                        </ol>
                      </li>
                      <li><strong>注意事项：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>需要单独申请，不是自动生成的</li>
                          <li>测试环境和生产环境使用不同的令牌</li>
                          <li>令牌有使用限制和配额</li>
                        </ul>
                      </li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">6. Refresh Token</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>OAuth 2.0 刷新令牌，用于获取访问令牌</li>
                      <li><strong>格式：</strong>长字符串</li>
                      <li><strong>获取方式：</strong>
                        <ol className="list-decimal list-inside mt-1 ml-4">
                          <li>使用 OAuth 2.0 授权流程获取</li>
                          <li>需要用户授权</li>
                          <li>系统会自动处理授权流程</li>
                        </ol>
                      </li>
                      <li><strong>注意事项：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>长期有效，除非用户撤销授权</li>
                          <li>需要安全存储</li>
                          <li>用于定期获取新的访问令牌</li>
                        </ul>
                      </li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">7. Login Customer ID (MCC ID)</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>MCC（My Client Center）管理员账户的ID</li>
                      <li><strong>格式：</strong>123-456-7890（单个ID）</li>
                      <li><strong>示例：</strong>"123-456-7890"</li>
                      <li><strong>获取方式：</strong>
                        <ol className="list-decimal list-inside mt-1 ml-4">
                          <li>登录 <a href="https://ads.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Ads</a></li>
                          <li>查看右上角账户列表，找到带有"MCC"标签的账户</li>
                          <li>在账户设置中查看MCC ID</li>
                        </ol>
                      </li>
                      <li><strong>注意事项：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>这是您的管理员账户ID，用于管理多个客户账户</li>
                          <li>每个配置只能使用一个MCC账户</li>
                          <li>确保该MCC账户有权限访问所有要管理的客户账户</li>
                        </ul>
                      </li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">8. Customer ID</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>具体的Google Ads客户账户ID</li>
                      <li><strong>格式：</strong>123-456-7890，支持多个ID</li>
                      <li><strong>示例：</strong>"123-456-7890"（每行一个ID）</li>
                      <li><strong>获取方式：</strong>
                        <ol className="list-decimal list-inside mt-1 ml-4">
                          <li>在MCC账户下的客户账户列表中查看</li>
                          <li>或在每个客户账户的设置中查看</li>
                          <li>支持填写多个客户账户ID，每行一个</li>
                        </ol>
                      </li>
                      <li><strong>注意事项：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>这些是具体的广告客户账户</li>
                          <li>所有填写的客户账户必须属于同一个MCC账户</li>
                          <li>多个客户账户ID请分行填写，每行一个</li>
                        </ul>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* 广告联盟链接配置 */}
          <section id="affiliate-links" className="scroll-mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-green-600" />
                  广告联盟链接配置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-green-800">
                    广告联盟链接配置用于管理需要自动化处理的推广链接，系统将根据这些链接更新 Google Ads 广告。
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">1. 链接名称 *</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>给广告联盟链接起的易于识别的名称</li>
                      <li><strong>格式：</strong>自定义文本</li>
                      <li><strong>示例：</strong>"Home Depot 主链接"、"Amazon 联盟链接"</li>
                      <li><strong>获取方式：</strong>用户自定义</li>
                      <li><strong>注意事项：</strong>建议包含广告商名称和链接特征</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">2. 分类</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>链接所属的业务分类</li>
                      <li><strong>格式：</strong>预定义的分类选项</li>
                      <li><strong>可选值：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>零售电商</li>
                          <li>旅游出行</li>
                          <li>金融服务</li>
                          <li>教育培训</li>
                          <li>其他</li>
                        </ul>
                      </li>
                      <li><strong>获取方式：</strong>用户选择</li>
                      <li><strong>注意事项：</strong>分类有助于批量管理和统计</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">3. 广告联盟链接 *</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>需要处理的广告联盟链接 URL</li>
                      <li><strong>格式：</strong>完整的 URL，包含必要的追踪参数</li>
                      <li><strong>示例：</strong>"https://yeahpromos.com/click?id=12345&offer_id=67890"</li>
                      <li><strong>获取方式：</strong>
                        <ol className="list-decimal list-inside mt-1 ml-4">
                          <li>登录广告联盟平台（如 YeahPromos）</li>
                          <li>获取推广链接</li>
                          <li>复制包含追踪参数的完整链接</li>
                        </ol>
                      </li>
                      <li><strong>注意事项：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>确保链接包含所有必要的追踪参数</li>
                          <li>链接应该是有效的，能够正常访问</li>
                          <li>避免使用包含会话过期的链接</li>
                        </ul>
                      </li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">4. 描述</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>链接的详细描述和使用说明</li>
                      <li><strong>格式：</strong>自定义文本</li>
                      <li><strong>示例：</strong>"Home Depot 主页推广链接，用于品牌关键词广告"</li>
                      <li><strong>获取方式：</strong>用户自定义</li>
                      <li><strong>注意事项：</strong>详细描述有助于理解链接用途和管理</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* AdsPower 环境配置 */}
          <section id="adspower" className="scroll-mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-600" />
                  AdsPower 环境配置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-purple-800">
                    AdsPower 是一款浏览器自动化工具，用于模拟用户访问链接。配置 AdsPower 环境使系统能够自动化打开和处理链接。
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="border-l-4 border-purple-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">1. 环境名称 *</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>给 AdsPower 环境起的名称</li>
                      <li><strong>格式：</strong>自定义文本</li>
                      <li><strong>示例：</strong>"主浏览器环境"、"IP 轮换环境"</li>
                      <li><strong>获取方式：</strong>用户自定义</li>
                      <li><strong>注意事项：</strong>名称应反映环境的用途或特征</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-purple-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">2. 环境 ID *</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>AdsPower 浏览器配置文件的唯一标识</li>
                      <li><strong>格式：</strong>字符串，通常为字母和数字组合</li>
                      <li><strong>示例：</strong>"j1nqjy0"</li>
                      <li><strong>获取方式：</strong>
                        <ol className="list-decimal list-inside mt-1 ml-4">
                          <li>打开 AdsPower 软件</li>
                          <li>创建或选择浏览器配置文件</li>
                          <li>在配置文件详情中查看环境 ID</li>
                          <li>或在浏览器配置文件列表中查看</li>
                        </ol>
                      </li>
                      <li><strong>注意事项：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>每个 AdsPower 配置文件有唯一的 ID</li>
                          <li>确保 ID 准确无误</li>
                        </ul>
                      </li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-purple-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">3. API 端点</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>AdsPower API 服务的访问地址</li>
                      <li><strong>格式：</strong>URL</li>
                      <li><strong>默认值：</strong>"http://local.adspower.net:50325"</li>
                      <li><strong>示例：</strong>"http://local.adspower.net:50325"</li>
                      <li><strong>获取方式：</strong>
                        <ol className="list-decimal list-inside mt-1 ml-4">
                          <li>查看 AdsPower 软件设置</li>
                          <li>确认 API 服务端口</li>
                          <li>默认端口为 50325</li>
                        </ol>
                      </li>
                      <li><strong>注意事项：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>确保 AdsPower 软件正在运行</li>
                          <li>确保防火墙允许访问该端口</li>
                          <li>如果使用远程服务器，需要相应配置</li>
                        </ul>
                      </li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-purple-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">4. API 密钥</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>AdsPower API 访问密钥（可选）</li>
                      <li><strong>格式：</strong>字符串</li>
                      <li><strong>获取方式：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>AdsPower 设置中可能需要配置 API 密钥</li>
                          <li>或联系 AdsPower 支持获取</li>
                        </ul>
                      </li>
                      <li><strong>注意事项：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>如果 AdsPower 不需要认证，可以留空</li>
                          <li>建议设置密钥以提高安全性</li>
                        </ul>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* 执行配置创建 */}
          <section id="execution-config" className="scroll-mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-orange-600" />
                  执行配置创建
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-orange-800">
                    执行配置是将 Google Ads 账号、广告联盟链接和 AdsPower 环境整合起来的自动化任务配置。
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="border-l-4 border-orange-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">1. 配置名称 *</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>给执行配置起的名称</li>
                      <li><strong>格式：</strong>自定义文本</li>
                      <li><strong>示例：</strong>"每日自动化更新"、"Home Depot 专项任务"</li>
                      <li><strong>获取方式：</strong>用户自定义</li>
                      <li><strong>注意事项：</strong>名称应反映配置的用途或执行频率</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-orange-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">2. 描述</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>配置的详细说明</li>
                      <li><strong>格式：</strong>自定义文本</li>
                      <li><strong>获取方式：</strong>用户自定义</li>
                      <li><strong>注意事项：</strong>详细描述有助于理解配置目的</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-orange-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">3. AdsPower 环境 *</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>选择要使用的 AdsPower 环境</li>
                      <li><strong>格式：</strong>下拉选择</li>
                      <li><strong>获取方式：</strong>从已配置的 AdsPower 环境中选择</li>
                      <li><strong>注意事项：</strong>确保所选环境正常运行</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-orange-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">4. 执行次数</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>每次任务执行的重复次数</li>
                      <li><strong>格式：</strong>数字，1-10</li>
                      <li><strong>默认值：</strong>1</li>
                      <li><strong>获取方式：</strong>用户输入</li>
                      <li><strong>注意事项：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>次数越多，执行时间越长</li>
                          <li>建议根据需求合理设置</li>
                          <li>过多次数可能触发反爬机制</li>
                        </ul>
                      </li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-orange-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">5. 通知邮箱</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>执行结果通知邮箱地址</li>
                      <li><strong>格式：</strong>Email 地址</li>
                      <li><strong>示例：</strong>"your@email.com"</li>
                      <li><strong>获取方式：</strong>用户输入</li>
                      <li><strong>注意事项：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>可选参数</li>
                          <li>确保邮箱地址正确</li>
                          <li>系统会在任务完成或出错时发送通知</li>
                        </ul>
                      </li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-orange-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">6. 广告联盟链接</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>选择要处理的广告联盟链接</li>
                      <li><strong>格式：</strong>复选框多选</li>
                      <li><strong>获取方式：</strong>从已配置的链接中选择</li>
                      <li><strong>注意事项：</strong>至少选择一个链接</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-orange-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">7. Google Ads 账户</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>含义：</strong>选择要更新的 Google Ads 账户</li>
                      <li><strong>格式：</strong>复选框多选</li>
                      <li><strong>获取方式：</strong>从已配置的账户中选择</li>
                      <li><strong>注意事项：</strong>至少选择一个账户</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* 自动化任务设置 */}
          <section id="automation" className="scroll-mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-600" />
                  自动化任务设置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <p className="text-indigo-800">
                    自动化任务设置用于配置定时执行或手动触发任务。
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="border-l-4 border-indigo-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">配置说明</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>访问方式：</strong>点击"前往任务调度页面"</li>
                      <li><strong>功能：</strong>配置定时任务、设置执行频率、管理任务队列</li>
                      <li><strong>注意事项：</strong>需要先完成基础配置才能使用</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* 系统验证测试 */}
          <section id="verification" className="scroll-mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-teal-600" />
                  系统验证测试
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-teal-50 p-4 rounded-lg">
                  <p className="text-teal-800">
                    系统验证用于检查所有配置是否正确，确保系统能够正常运行。
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="border-l-4 border-teal-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">1. 运行系统验证</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>功能：</strong>检查所有组件的连接状态和配置完整性</li>
                      <li><strong>验证项目：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>Google Ads 账号连接</li>
                          <li>广告联盟链接有效性</li>
                          <li>AdsPower 环境可用性</li>
                          <li>执行配置完整性</li>
                        </ul>
                      </li>
                      <li><strong>注意事项：</strong>必须在所有配置完成后运行</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-teal-500 pl-4">
                    <h4 className="font-semibold text-lg mb-2">2. 执行测试运行</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li><strong>功能：</strong>模拟真实执行流程，验证系统功能</li>
                      <li><strong>测试内容：</strong>
                        <ul className="list-disc list-inside mt-1 ml-4">
                          <li>模拟链接访问</li>
                          <li>验证数据提取</li>
                          <li>测试广告更新</li>
                        </ul>
                      </li>
                      <li><strong>注意事项：</strong>需要先创建执行配置</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* 常见问题 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                常见问题
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="border-l-4 border-red-500 pl-4">
                  <h4 className="font-semibold mb-2">1. Google Ads 连接失败</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    <li>检查 API 凭据是否正确</li>
                    <li>确认已启用 Google Ads API</li>
                    <li>验证开发者令牌状态</li>
                  </ul>
                </div>

                <div className="border-l-4 border-red-500 pl-4">
                  <h4 className="font-semibold mb-2">2. 链接无法访问</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    <li>检查链接格式是否正确</li>
                    <li>确认链接是否已过期</li>
                    <li>验证网络连接</li>
                  </ul>
                </div>

                <div className="border-l-4 border-red-500 pl-4">
                  <h4 className="font-semibold mb-2">3. AdsPower 连接异常</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    <li>确保 AdsPower 软件正在运行</li>
                    <li>检查 API 端点和端口</li>
                    <li>验证环境 ID 是否正确</li>
                  </ul>
                </div>

                <div className="border-l-4 border-red-500 pl-4">
                  <h4 className="font-semibold mb-2">4. 任务执行失败</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    <li>检查所有配置是否完整</li>
                    <li>确认网络连接稳定</li>
                    <li>查看详细错误日志</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 安全注意事项 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                安全注意事项
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                <div>
                  <h4 className="font-semibold text-blue-900 mb-2">1. API 凭据安全</h4>
                  <ul className="list-disc list-inside text-blue-800 space-y-1">
                    <li>不要在前端代码中暴露敏感信息</li>
                    <li>定期轮换密钥和令牌</li>
                    <li>使用环境变量存储敏感信息</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-blue-900 mb-2">2. 访问控制</h4>
                  <ul className="list-disc list-inside text-blue-800 space-y-1">
                    <li>限制对配置页面的访问权限</li>
                    <li>使用强密码保护账号</li>
                    <li>定期检查账号活动</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-blue-900 mb-2">3. 数据保护</h4>
                  <ul className="list-disc list-inside text-blue-800 space-y-1">
                    <li>不要记录敏感信息</li>
                    <li>使用 HTTPS 加密传输</li>
                    <li>定期备份数据</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 联系支持 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                联系支持
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 mb-4">
                如果遇到配置问题或有其他疑问，请联系技术支持：
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="font-semibold text-green-900">邮箱</div>
                  <div className="text-green-700">support@autoads.dev</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="font-semibold text-blue-900">文档</div>
                  <a href="https://docs.autoads.dev" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                    docs.autoads.dev <ExternalLink className="h-3 w-3 inline" />
                  </a>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="font-semibold text-purple-900">社区</div>
                  <a href="https://community.autoads.dev" target="_blank" rel="noopener noreferrer" className="text-purple-700 hover:underline">
                    community.autoads.dev <ExternalLink className="h-3 w-3 inline" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
          <p>最后更新：2025-08-02</p>
        </div>
      </div>
    </div>
  );
}
