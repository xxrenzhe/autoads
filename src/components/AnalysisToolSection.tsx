"use client";

interface AnalysisToolSectionProps {
  locale: string;
}

const AnalysisToolSection = ({ locale }: AnalysisToolSectionProps) => {
  return (
    <section className="py-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            真实点击工具 {/* 始终显示中文 */}
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            专业的真实点击平台，支持多URL和单URL重复模式，提供智能标签页管理和IP轮换功能 {/* 始终显示中文 */}
          </p>
        </div>
      </div>
    </section>
  );
};

export default AnalysisToolSection;
