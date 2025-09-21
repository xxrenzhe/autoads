"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle,
  Clock,
  FileText,
  Gavel,
  Globe,
  Mail,
  Scale,
  Shield,
  Users,
  Zap,
} from "lucide-react";

export default function TermsPage() {
  const { locale } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <section className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {locale === "zh" ? "服务条款" : "Terms of Service"}
          </h1>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto">
            {locale === "zh"
              ? "欢迎使用AutoAds！请仔细阅读以下服务条款，使用我们的服务即表示您同意遵守这些条款"
              : "Welcome to AutoAds! Please carefully read the following terms of service. Using our services indicates your agreement to comply with these terms"}
          </p>
        </section>

        {/* Service Overview */}
        <Card className="shadow-xl border-0 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl mb-8">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <Globe className="h-12 w-12 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-blue-900">
              {locale === "zh" ? "服务概述" : "Service Overview"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              {locale === "zh"
                ? "AutoAds是业界领先的网站权威度分析平台，为全球企业提供专业的网站排名分析、批量URL处理和数字营销决策支持服务。我们致力于通过技术创新和权威数据，为用户提供最准确、最可靠的分析结果。"
                : "AutoAds is the industry-leading website authority analysis platform, providing professional website ranking analysis, batch URL processing, and digital marketing decision support services for global enterprises. We are committed to providing users with the most accurate and reliable analysis results through technological innovation and authoritative data."}
            </p>
          </CardContent>
        </Card>

        {/* Core Terms */}
        <section className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-green-600" />
                <CardTitle className="text-lg">
                  {locale === "zh" ? "服务内容" : "Service Content"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">
                {locale === "zh"
                  ? "提供Google OAuth安全身份验证、网站批量分析、排名查询、权威度评估、优先级计算等专业工具服务，支持多种数据格式导入导出。"
                  : "Provides Google OAuth secure authentication, website batch analysis, ranking queries, authority assessment, priority calculation, and other professional tool services, supporting multiple data format import and export."}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-violet-50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-purple-600" />
                <CardTitle className="text-lg">
                  {locale === "zh" ? "用户责任" : "User Responsibilities"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">
                {locale === "zh"
                  ? "使用真实有效的Google账户进行身份验证，确保输入数据合法、无侵权，遵守相关法律法规，不得用于非法用途或恶意攻击。"
                  : "Use a valid Google account for authentication, ensure input data is legal and non-infringing, comply with relevant laws and regulations, and not use for illegal purposes or malicious attacks."}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-gradient-to-br from-orange-50 to-amber-50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Scale className="h-6 w-6 text-orange-600" />
                <CardTitle className="text-lg">
                  {locale === "zh" ? "免责声明" : "Disclaimer"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">
                {locale === "zh"
                  ? "我们努力保证数据准确性，但不对因使用本产品造成的任何直接或间接损失承担责任。"
                  : "We strive to ensure data accuracy but are not responsible for any direct or indirect losses caused by using our products."}
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Detailed Terms */}
        <Card className="shadow-xl border-0 bg-white/70 backdrop-blur-sm rounded-xl mb-8">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-xl pb-4">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-indigo-900">
              <BookOpen className="h-6 w-6 text-indigo-600" />
              {locale === "zh" ? "详细条款" : "Detailed Terms"}
            </h2>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-8">
              {/* Service Usage */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  {locale === "zh" ? "服务使用条款" : "Service Usage Terms"}
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <span className="font-medium text-gray-900">
                          {locale === "zh" ? "身份验证：" : "Authentication:"}
                        </span>
                        <span className="text-sm text-gray-700">
                          {locale === "zh"
                            ? "我们使用Google OAuth 2.0提供安全的身份验证服务，仅请求基本权限（openid, email, profile），不会访问您的其他Google服务数据。"
                            : "We use Google OAuth 2.0 to provide secure authentication services, requesting only basic permissions (openid, email, profile) without accessing your other Google service data."}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <span className="font-medium text-gray-900">
                          {locale === "zh" ? "授权使用：" : "Authorized Use:"}
                        </span>
                        <span className="text-sm text-gray-700">
                          {locale === "zh"
                            ? "我们授予您非独占、不可转让的使用权，用于合法的商业和个人用途。"
                            : "We grant you a non-exclusive, non-transferable right to use for legitimate commercial and personal purposes."}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <span className="font-medium text-gray-900">
                          {locale === "zh"
                            ? "服务可用性："
                            : "Service Availability:"}
                        </span>
                        <span className="text-sm text-gray-700">
                          {locale === "zh"
                            ? "我们努力保持服务的高可用性，但可能因维护、升级等原因暂时中断。"
                            : "We strive to maintain high service availability but may temporarily interrupt due to maintenance, upgrades, etc."}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <div>
                        <span className="font-medium text-gray-900">
                          {locale === "zh" ? "数据准确性：" : "Data Accuracy:"}
                        </span>
                        <span className="text-sm text-gray-700">
                          {locale === "zh"
                            ? "我们使用权威数据源，但建议您验证重要数据的准确性。"
                            : "We use authoritative data sources, but we recommend you verify the accuracy of important data."}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
                      <div>
                        <span className="font-medium text-gray-900">
                          {locale === "zh"
                            ? "账户安全："
                            : "Account Security:"}
                        </span>
                        <span className="text-sm text-gray-700">
                          {locale === "zh"
                            ? "您有责任保护您的Google账户安全，不得与他人共享账户信息或进行未授权的访问。"
                            : "You are responsible for protecting your Google account security and must not share account information or perform unauthorized access."}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
                      <div>
                        <span className="font-medium text-gray-900">
                          {locale === "zh"
                            ? "禁止行为："
                            : "Prohibited Actions:"}
                        </span>
                        <span className="text-sm text-gray-700">
                          {locale === "zh"
                            ? "不得进行恶意攻击、数据爬取、服务滥用等违规行为。"
                            : "No malicious attacks, data scraping, service abuse, or other violations are allowed."}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
                      <div>
                        <span className="font-medium text-gray-900">
                          {locale === "zh" ? "使用限制：" : "Usage Limits:"}
                        </span>
                        <span className="text-sm text-gray-700">
                          {locale === "zh"
                            ? "我们保留对异常使用行为进行限制或终止服务的权利。"
                            : "We reserve the right to restrict or terminate services for abnormal usage behavior."}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
                      <div>
                        <span className="font-medium text-gray-900">
                          {locale === "zh"
                            ? "合规要求："
                            : "Compliance Requirements:"}
                        </span>
                        <span className="text-sm text-gray-700">
                          {locale === "zh"
                            ? "用户必须遵守当地法律法规，不得用于非法目的。"
                            : "Users must comply with local laws and regulations and not use for illegal purposes."}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Intellectual Property */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Gavel className="h-5 w-5 text-purple-600" />
                  {locale === "zh" ? "知识产权" : "Intellectual Property"}
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-gray-700">
                    {locale === "zh"
                      ? "AutoAds及其相关技术、算法、界面设计等知识产权归我们所有。用户获得的是服务使用权，而非知识产权。"
                      : "AutoAds and its related technologies, algorithms, interface designs, and other intellectual property rights belong to us. Users obtain service usage rights, not intellectual property rights."}
                  </p>
                  <p className="text-sm text-gray-700">
                    {locale === "zh"
                      ? "用户通过我们的服务生成的分析结果，其知识产权归属遵循相关法律法规和行业惯例。"
                      : "The intellectual property rights of analysis results generated by users through our services follow relevant laws and regulations and industry practices."}
                  </p>
                </div>
              </div>

              {/* Privacy and Data */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  {locale === "zh" ? "隐私与数据" : "Privacy and Data"}
                </h3>
                <div className="bg-green-50 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-gray-700">
                    {locale === "zh"
                      ? "我们采用零数据泄露的本地化架构，所有数据处理均在您的浏览器中完成，不会向服务器传输敏感信息。"
                      : "We adopt a zero data leakage local architecture. All data processing is completed in your browser without transmitting sensitive information to servers."}
                  </p>
                  <p className="text-sm text-gray-700">
                    {locale === "zh"
                      ? "通过Google OAuth登录时，我们仅收集基本的身份信息（姓名、邮箱、头像），不会访问您的Gmail、Drive或其他Google服务数据。"
                      : "When signing in with Google OAuth, we only collect basic identity information (name, email, avatar) and do not access your Gmail, Drive, or other Google service data."}
                  </p>
                  <p className="text-sm text-gray-700">
                    {locale === "zh"
                      ? "您可以随时在Google账户设置中撤销对我们应用的授权，或删除您的账户数据。"
                      : "You can revoke authorization to our application in your Google account settings at any time, or delete your account data."}
                  </p>
                </div>
              </div>

              {/* Google OAuth Compliance */}
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Gavel className="h-5 w-5 text-blue-600" />
                  {locale === "zh" ? "Google OAuth 合规" : "Google OAuth Compliance"}
                </h3>
                <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-gray-700">
                    {locale === "zh"
                      ? "我们的Google OAuth集成完全符合Google的API服务用户数据政策和开发者政策。我们承诺："
                      : "Our Google OAuth integration fully complies with Google's API Services User Data Policy and Developer Policy. We commit to:"}
                  </p>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <span>
                        {locale === "zh"
                          ? "仅请求应用功能必需的最小权限"
                          : "Request only the minimum permissions necessary for app functionality"}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <span>
                        {locale === "zh"
                          ? "透明地说明数据使用目的和方式"
                          : "Transparently explain the purpose and method of data use"}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <span>
                        {locale === "zh"
                          ? "不会将用户数据用于广告或其他商业目的"
                          : "Will not use user data for advertising or other commercial purposes"}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <span>
                        {locale === "zh"
                          ? "遵守所有适用的数据保护法律法规"
                          : "Comply with all applicable data protection laws and regulations"}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms Updates */}
        <Card className="shadow-xl border-0 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl mb-8">
          <CardHeader className="pb-4">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-amber-900">
              <Clock className="h-6 w-6 text-amber-600" />
              {locale === "zh" ? "条款更新" : "Terms Updates"}
            </h2>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <p className="text-gray-700">
                {locale === "zh"
                  ? "我们有权根据业务发展、法律法规变化或技术更新需要，随时更新服务条款。更新后的条款将在本页面公示，并标注更新时间。"
                  : "We reserve the right to update service terms at any time based on business development, legal and regulatory changes, or technical update needs. Updated terms will be posted on this page with update timestamps."}
              </p>
              <div className="bg-white/50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">
                  {locale === "zh"
                    ? "更新通知方式："
                    : "Update Notification Methods:"}
                </h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>
                      {locale === "zh"
                        ? "本页面公示更新内容"
                        : "Post update content on this page"}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>
                      {locale === "zh"
                        ? "重要更新将通过邮件通知"
                        : "Important updates will be notified via email"}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>
                      {locale === "zh"
                        ? "继续使用服务视为接受新条款"
                        : "Continued use of services indicates acceptance of new terms"}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="shadow-xl border-0 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
          <CardHeader className="pb-4">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-blue-900">
              <Mail className="h-6 w-6 text-blue-600" />
              {locale === "zh" ? "条款咨询" : "Terms Inquiries"}
            </h2>
          </CardHeader>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <p className="text-gray-700">
                {locale === "zh"
                  ? "如果您对我们的服务条款有任何疑问或建议，请随时联系我们。我们的法律团队将为您提供专业的解答。"
                  : "If you have any questions or suggestions about our terms of service, please feel free to contact us. Our legal team will provide you with professional answers."}
              </p>
              <div className="flex justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 text-blue-800 text-lg px-4 py-2"
                  >
                    legal@autoads.dev
                  </Badge>
                  <p className="text-xs text-gray-500">
                    {locale === "zh"
                      ? "Google OAuth服务条款问题: oauth@autoads.dev"
                      : "Google OAuth terms questions: oauth@autoads.dev"}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                {locale === "zh"
                  ? "最后更新时间：2024年12月"
                  : "Last updated: December 2024"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
