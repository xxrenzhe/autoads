/**
 * 功能说明组件
 * 显示静默版本的功能介绍、技术特点和注意事项
 */

import React from 'react';
import { SafeI18nHtml } from '@/components/SafeHtml';
import { createClientLogger } from '@/lib/utils/security/client-secure-logger';

const logger = createClientLogger('FeatureDescription');

interface FeatureDescriptionProps {
  getTranslation: (t: (key: string) => string | string[], key: string) => string;
  t: (key: string) => string | string[];
}

export const FeatureDescription: React.FC<FeatureDescriptionProps> = ({
  getTranslation,
  t
}) => {
  logger.debug('FeatureDescription组件渲染');

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* 主标题 */}
      <h3 className="text-xl font-bold mb-6 text-slate-900 border-b border-slate-200 pb-2">
        {getTranslation(t, "batchOpenSection.silentVersion.title")}
      </h3>
      
      {/* 静默版本说明区 */}
      <div className="space-y-5">
        {/* 功能说明 */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <span className="text-purple-600 text-base">🤖</span>
            <div>
              <h4 className="font-semibold text-purple-900 text-base mb-2">
                {getTranslation(t, "batchOpenSection.featureDescription.featuresTitle")}
              </h4>
              <div className="text-purple-800 text-sm leading-relaxed">
                <SafeI18nHtml
                  html={getTranslation(t, "batchOpenSection.silentVersion.tip") as string}
                  as="p"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 技术特点 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 text-base mb-3 flex items-center gap-2">
            <span className="text-blue-600">⚙️</span>
            {getTranslation(t, "batchOpenSection.featureDescription.technicalTitle")}
          </h4>
          <ul className="list-disc list-inside text-blue-800 text-sm leading-relaxed space-y-2">
            {(t("batchOpenSection.featureDescription.technicalFeatures") as string[]).map((feature, index) => (
              <li key={index}>{feature}</li>
            ))}
          </ul>
        </div>

        {/* 注意事项 */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-900 text-base mb-3 flex items-center gap-2">
            <span className="text-red-600">⚠️</span>
            {getTranslation(t, "batchOpenSection.featureDescription.notesTitle")}
          </h4>
          <ul className="list-disc list-inside text-red-800 text-sm leading-relaxed space-y-2">
            {(t("batchOpenSection.featureDescription.notes") as string[]).map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};