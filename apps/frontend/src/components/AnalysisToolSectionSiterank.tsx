"use client";

interface AnalysisToolSectionSiterankProps {
  locale: string;
}

const AnalysisToolSectionSiterank = ({ locale }: .*Props) {
  return (
    <section className="py-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            {"网站排名分析工具" /* 始终显示中文 */}
          </h1>
          <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-4xl mx-auto">
            {"分析网站全球排名和PageRank，智能计算测试优先级，为您的营销决策提供数据支持" /* 始终显示中文 */}
          </p>
        </div>
      </div>
    </section>
  );
};

export default AnalysisToolSectionSiterank;