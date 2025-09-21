"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import GenericHeroSection from "@/components/common/GenericHeroSection";
import {
  Award,
  BarChart3,
  Database,
  Globe,
  Lock,
  Shield,
  Target,
  Users,
  Zap,
} from "lucide-react";

export default function AboutPage() {
  const { locale } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <GenericHeroSection 
          title={locale === "zh" ? "关于 AutoAds" : "About AutoAds"}
          description={locale === "zh"
            ? "业界领先的网站权威度分析平台，专为品牌投放、SEO优化和数字营销专业人士打造"
            : "The industry-leading website authority analysis platform, designed for brand bidding, SEO optimization, and digital marketing professionals"
          }
          titleClassName="text-4xl font-bold text-gray-900 mb-4"
          descriptionClassName="text-xl text-gray-600 max-w-4xl mx-auto"
        />

        {/* Mission Statement */}
        <Card className="shadow-xl border-0 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl mb-8">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <Target className="h-12 w-12 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-blue-900">
              {locale === "zh" ? "我们的使命" : "Our Mission"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              {locale === "zh"
                ? "通过权威的网站排名数据和智能分析工具，为全球企业提供精准的品牌投放决策支持，推动数字营销行业的专业化和智能化发展。"
                : "Through authoritative website ranking data and intelligent analysis tools, we provide precise brand bidding decision support for global enterprises, promoting the professionalization and intelligent development of the digital marketing industry."}
            </p>
          </CardContent>
        </Card>

        {/* Core Values */}
        <section className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Award className="h-6 w-6 text-green-600" />
                <CardTitle className="text-lg">
                  {locale === "zh" ? "专业权威" : "Professional Authority"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">
                {locale === "zh"
                  ? "独家集成Open PageRank官方API，提供全球最权威的网站排名数据，确保分析结果的准确性和可靠性。"
                  : "Exclusively integrates Open PageRank official API to provide the world's most authoritative website ranking data, ensuring accuracy and reliability of analysis results."}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-violet-50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-6 w-6 text-purple-600" />
                <CardTitle className="text-lg">
                  {locale === "zh" ? "技术创新" : "Technical Innovation"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">
                {locale === "zh"
                  ? "采用AI驱动的优先级算法和自适应并发引擎，为企业级用户提供高效、智能的数据处理解决方案。"
                  : "Uses AI-driven priority algorithms and adaptive concurrency engines to provide efficient, intelligent data processing solutions for enterprise users."}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-gradient-to-br from-orange-50 to-amber-50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-orange-600" />
                <CardTitle className="text-lg">
                  {locale === "zh" ? "隐私安全" : "Privacy & Security"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">
                {locale === "zh"
                  ? "采用零数据泄露的本地化架构，确保用户数据安全，符合企业级安全标准和隐私保护要求。"
                  : "Adopts zero data leakage local architecture to ensure user data security, compliant with enterprise security standards and privacy protection requirements."}
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Team & Expertise */}
        <Card className="shadow-xl border-0 bg-white/70 backdrop-blur-sm rounded-xl mb-8">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-xl pb-4">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-indigo-900">
              <Users className="h-6 w-6 text-indigo-600" />
              {locale === "zh" ? "专业团队" : "Professional Team"}
            </h2>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  {locale === "zh" ? "核心团队" : "Core Team"}
                </h3>
                <p className="text-gray-700">
                  {locale === "zh"
                    ? "我们的团队由经验丰富的全栈开发者、数据科学家和数字营销专家组成，平均拥有8年以上的行业经验。团队成员来自知名互联网公司和顶级咨询机构，具备深厚的技术功底和丰富的实战经验。"
                    : "Our team consists of experienced full-stack developers, data scientists, and digital marketing experts with an average of 8+ years of industry experience. Team members come from renowned internet companies and top consulting firms, possessing deep technical expertise and rich practical experience."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 text-blue-800"
                  >
                    {locale === "zh" ? "全栈开发" : "Full-Stack Development"}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800"
                  >
                    {locale === "zh" ? "数据科学" : "Data Science"}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-purple-100 text-purple-800"
                  >
                    {locale === "zh" ? "数字营销" : "Digital Marketing"}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-orange-100 text-orange-800"
                  >
                    {locale === "zh" ? "产品设计" : "Product Design"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  {locale === "zh" ? "技术优势" : "Technical Advantages"}
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Database className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <span className="font-medium text-gray-900">
                        {locale === "zh"
                          ? "企业级数据处理："
                          : "Enterprise Data Processing:"}
                      </span>
                      <span className="text-sm text-gray-700">
                        {locale === "zh"
                          ? "支持大规模真实点击，智能并发控制，确保高效率和稳定性。"
                          : "Supports large-scale batch processing with intelligent concurrency control for high efficiency and stability."}
                      </span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <BarChart3 className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div>
                      <span className="font-medium text-gray-900">
                        {locale === "zh"
                          ? "AI智能分析："
                          : "AI Intelligent Analysis:"}
                      </span>
                      <span className="text-sm text-gray-700">
                        {locale === "zh"
                          ? "基于机器学习的多维度优先级算法，提供精准的商业价值评估。"
                          : "Machine learning-based multi-dimensional priority algorithm providing accurate commercial value assessment."}
                      </span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Lock className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <span className="font-medium text-gray-900">
                        {locale === "zh"
                          ? "安全架构："
                          : "Security Architecture:"}
                      </span>
                      <span className="text-sm text-gray-700">
                        {locale === "zh"
                          ? "零数据泄露设计，符合企业级安全标准，保护用户隐私。"
                          : "Zero data leakage design, compliant with enterprise security standards, protecting user privacy."}
                      </span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="shadow-xl border-0 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl">
          <CardHeader className="pb-4">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-amber-900">
              <Globe className="h-6 w-6 text-amber-600" />
              {locale === "zh" ? "联系我们" : "Contact Us"}
            </h2>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {locale === "zh" ? "商务合作" : "Business Cooperation"}
                </h3>
                <p className="text-gray-700">
                  {locale === "zh"
                    ? "如果您有商务合作、技术咨询或定制开发需求，欢迎通过以下方式联系我们。我们承诺在24小时内回复您的咨询。"
                    : "If you have business cooperation, technical consultation, or custom development needs, please contact us through the following channels. We commit to responding to your inquiries within 24 hours."}
                </p>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    <strong>
                      {locale === "zh" ? "商务邮箱：" : "Business Email:"}
                    </strong>{" "}
                    business@autoads.dev
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>
                      {locale === "zh" ? "技术支持：" : "Technical Support:"}
                    </strong>{" "}
                    support@autoads.dev
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {locale === "zh" ? "产品反馈" : "Product Feedback"}
                </h3>
                <p className="text-gray-700">
                  {locale === "zh"
                    ? "我们重视每一位用户的反馈和建议。您的意见将帮助我们持续改进产品，为用户提供更好的服务体验。"
                    : "We value feedback and suggestions from every user. Your input will help us continuously improve our products and provide better service experiences for users."}
                </p>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    <strong>
                      {locale === "zh" ? "产品反馈：" : "Product Feedback:"}
                    </strong>{" "}
                    feedback@autoads.dev
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>GitHub:</strong> github.com/urlchecker
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
