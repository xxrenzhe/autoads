"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { GenericHeroSection } from "@/components/common/GenericHeroSection";
import {
  BarChart3,
  Clock,
  Github,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Shield,
  Users,
  Zap,
} from "lucide-react";

export default function ContactPage() {
  const { locale } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <GenericHeroSection 
          title={locale === "zh" ? "联系我们" : "Contact Us"}
          description={locale === "zh"
            ? "我们致力于为全球企业提供专业的网站权威度分析服务。无论您有任何问题、建议或合作需求，我们都将为您提供最优质的支持。"
            : "We are committed to providing professional website authority analysis services for global enterprises. Whether you have any questions, suggestions, or cooperation needs, we will provide you with the highest quality support."
          }
          titleClassName="text-4xl font-bold text-gray-900 mb-4"
          descriptionClassName="text-xl text-gray-600 max-w-4xl mx-auto"
        />

        {/* Contact Methods */}
        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* Business Cooperation */}
          <Card className="shadow-xl border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {locale === "zh" ? "商务合作" : "Business Cooperation"}
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 text-blue-800 text-xs"
                  >
                    {locale === "zh" ? "优先回复" : "Priority Response"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-700">
                {locale === "zh"
                  ? "企业级定制开发、API集成、技术咨询等商务合作需求，我们提供专业的技术团队支持。"
                  : "For enterprise-level custom development, API integration, technical consultation, and other business cooperation needs, we provide professional technical team support."}
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">business@autoads.dev</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span>
                    {locale === "zh"
                      ? "24小时内回复"
                      : "Response within 24 hours"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technical Support */}
          <Card className="shadow-xl border-0 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {locale === "zh" ? "技术支持" : "Technical Support"}
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800 text-xs"
                  >
                    {locale === "zh" ? "专业服务" : "Professional Service"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-700">
                {locale === "zh"
                  ? "产品使用问题、技术故障、功能咨询等，我们的技术专家将为您提供专业解答。"
                  : "For product usage issues, technical problems, feature consultation, etc., our technical experts will provide professional answers."}
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-green-600" />
                  <span className="font-medium">support@autoads.dev</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-green-600" />
                  <span>
                    {locale === "zh"
                      ? "48小时内回复"
                      : "Response within 48 hours"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Feedback */}
          <Card className="shadow-xl border-0 bg-gradient-to-br from-purple-50 to-violet-50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <MessageSquare className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {locale === "zh" ? "产品反馈" : "Product Feedback"}
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="bg-purple-100 text-purple-800 text-xs"
                  >
                    {locale === "zh" ? "持续改进" : "Continuous Improvement"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-700">
                {locale === "zh"
                  ? "功能建议、用户体验改进、新功能需求等，您的反馈将帮助我们持续优化产品。"
                  : "Feature suggestions, user experience improvements, new feature requirements, etc. Your feedback will help us continuously optimize our products."}
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-purple-600" />
                  <span className="font-medium">feedback@autoads.dev</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Github className="h-4 w-4 text-purple-600" />
                  <span>github.com/urlchecker</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contact Form */}
        <Card className="shadow-xl border-0 bg-white/70 backdrop-blur-sm rounded-xl mb-8">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-xl pb-4">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-indigo-900">
              <MessageSquare className="h-6 w-6 text-indigo-600" />
              {locale === "zh" ? "在线咨询" : "Online Consultation"}
            </h2>
          </CardHeader>
          <CardContent className="p-6">
            <form className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {locale === "zh" ? "姓名" : "Name"}
                  </label>
                  <Input
                    placeholder={
                      locale === "zh" ? "请输入您的姓名" : "Enter your name"
                    }
                    className="border-gray-300 focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {locale === "zh" ? "邮箱" : "Email"}
                  </label>
                  <Input
                    type="email"
                    placeholder={
                      locale === "zh" ? "请输入您的邮箱" : "Enter your email"
                    }
                    className="border-gray-300 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {locale === "zh" ? "咨询类型" : "Inquiry Type"}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    {locale === "zh" ? "商务合作" : "Business"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-green-300 text-green-700 hover:bg-green-50"
                  >
                    {locale === "zh" ? "技术支持" : "Support"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                  >
                    {locale === "zh" ? "产品反馈" : "Feedback"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {locale === "zh" ? "咨询内容" : "Message"}
                </label>
                <Textarea
                  placeholder={
                    locale === "zh"
                      ? "请详细描述您的需求或问题..."
                      : "Please describe your needs or questions in detail..."
                  }
                  rows={6}
                  className="border-gray-300 focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  {locale === "zh" ? "发送咨询" : "Send Inquiry"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Additional Information */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Company Information */}
          <Card className="shadow-lg border-0 bg-gradient-to-r from-amber-50 to-yellow-50">
            <CardHeader className="pb-4">
              <h3 className="flex items-center gap-2 text-xl font-bold text-amber-900">
                <Globe className="h-5 w-5 text-amber-600" />
                {locale === "zh" ? "公司信息" : "Company Information"}
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-gray-900">autoads.dev</p>
                    <p className="text-sm text-gray-600">
                      {locale === "zh" ? "官方网站" : "Official Website"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Github className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-gray-900">
                      github.com/urlchecker
                    </p>
                    <p className="text-sm text-gray-600">
                      {locale === "zh" ? "开源项目" : "Open Source Project"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {locale === "zh" ? "全球服务" : "Global Service"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {locale === "zh"
                        ? "支持多语言"
                        : "Multi-language Support"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Features */}
          <Card className="shadow-lg border-0 bg-gradient-to-r from-emerald-50 to-teal-50">
            <CardHeader className="pb-4">
              <h3 className="flex items-center gap-2 text-xl font-bold text-emerald-900">
                <Zap className="h-5 w-5 text-emerald-600" />
                {locale === "zh" ? "服务特色" : "Service Features"}
              </h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {locale === "zh"
                        ? "权威数据分析"
                        : "Authoritative Data Analysis"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {locale === "zh"
                        ? "Open PageRank官方API"
                        : "Open PageRank Official API"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {locale === "zh" ? "企业级安全" : "Enterprise Security"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {locale === "zh"
                        ? "零数据泄露架构"
                        : "Zero Data Leakage Architecture"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {locale === "zh"
                        ? "专业团队支持"
                        : "Professional Team Support"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {locale === "zh"
                        ? "8年+行业经验"
                        : "8+ Years Industry Experience"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
