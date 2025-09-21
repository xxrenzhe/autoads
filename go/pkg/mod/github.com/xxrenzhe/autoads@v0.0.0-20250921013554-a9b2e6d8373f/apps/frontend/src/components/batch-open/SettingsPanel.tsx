import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Settings } from 'lucide-react';
import { DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT } from './types';

interface SettingsPanelProps {
  settings: {
    delay: number;
    maxTabs: number;
    enableDelay: boolean;
    enableTabLimit: boolean;
    enableAutoClose: boolean;
    autoCloseDelay: number;
    enableBatchMode: boolean;
    batchSize: number;
    enableProgressiveOpen: boolean;
    enableSmartDelay: boolean;
    enableTabGrouping: boolean;
    tabGroupName: string;
    enableWindowMode: boolean;
    windowWidth: number;
    windowHeight: number;
    enableIncognito: boolean;
    enablePinTabs: boolean;
    enableMuteTabs: boolean;
  };
  onSettingChange: (key: string, value: unknown) => void;
  locale: string;
  showAdvancedSettings: boolean;
  onToggleAdvancedSettings: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingChange,
  locale,
  showAdvancedSettings,
  onToggleAdvancedSettings
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          {locale === "zh" ? "打开设置" : "Opening Settings"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 基础设置 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="enable-delay" className="text-sm font-medium">
              {locale === "zh" ? "启用延迟" : "Enable Delay"}
            </label>
            <input
              id="enable-delay"
              type="checkbox"
              checked={settings.enableDelay}
              onChange={(e) => onSettingChange('enableDelay', (e.target as HTMLInputElement).checked)}
              className="rounded"
            />
          </div>
          
          {settings.enableDelay && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {locale === "zh" ? `延迟时间: ${settings.delay}ms` : `Delay: ${settings.delay}ms`}
              </label>
              <input
                type="range"
                value={settings.delay}
                onChange={(e) => onSettingChange('delay', parseInt((e.target as HTMLInputElement).value))}
                max={5000}
                min={100}
                step={100}
                className="w-full"
              />
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <label htmlFor="enable-tab-limit" className="text-sm font-medium">
              {locale === "zh" ? "限制标签页数量" : "Limit Tab Count"}
            </label>
            <input
              id="enable-tab-limit"
              type="checkbox"
              checked={settings.enableTabLimit}
              onChange={(e) => onSettingChange('enableTabLimit', (e.target as HTMLInputElement).checked)}
              className="rounded"
            />
          </div>
          
          {settings.enableTabLimit && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {locale === "zh" ? `最大标签页: ${settings.maxTabs}` : `Max Tabs: ${settings.maxTabs}`}
              </label>
              <input
                type="range"
                value={settings.maxTabs}
                onChange={(e) => onSettingChange('maxTabs', parseInt((e.target as HTMLInputElement).value))}
                max={50}
                min={1}
                step={1}
                className="w-full"
              />
            </div>
          )}
        </div>

        {/* 高级设置 */}
        <div>
          <button
            onClick={onToggleAdvancedSettings}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            <span className={`transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`}>▼</span>
            {locale === "zh" ? "高级设置" : "Advanced Settings"}
          </button>
          
          {showAdvancedSettings && (
            <div className="space-y-4 mt-4">
              {/* 窗口模式 */}
              <div className="flex items-center justify-between">
                <label htmlFor="enable-window-mode" className="text-sm font-medium">
                  {locale === "zh" ? "新窗口模式" : "New Window Mode"}
                </label>
                <input
                  id="enable-window-mode"
                  type="checkbox"
                  checked={settings.enableWindowMode}
                  onChange={(e) => onSettingChange('enableWindowMode', (e.target as HTMLInputElement).checked)}
                  className="rounded"
                />
              </div>
              
              {settings.enableWindowMode && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="window-width" className="text-sm font-medium">
                      {locale === "zh" ? "窗口宽度" : "Window Width"}
                    </label>
                    <Input
                      id="window-width"
                      type="number"
                      value={settings.windowWidth}
                      onChange={(e) => onSettingChange('windowWidth', parseInt((e.target as HTMLInputElement).value) || DEFAULT_WINDOW_WIDTH)}
                      min={400}
                      max={2000}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="window-height" className="text-sm font-medium">
                      {locale === "zh" ? "窗口高度" : "Window Height"}
                    </label>
                    <Input
                      id="window-height"
                      type="number"
                      value={settings.windowHeight}
                      onChange={(e) => onSettingChange('windowHeight', parseInt((e.target as HTMLInputElement).value) || DEFAULT_WINDOW_HEIGHT)}
                      min={300}
                      max={1500}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
