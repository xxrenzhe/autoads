'use client';

import React, { memo } from 'react';
import { Button } from '@/components/ui/button';

interface KeyboardHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardHelpModal = memo(({ isOpen, onClose }: KeyboardHelpModalProps) => {
  if (!isOpen) return null as any;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">键盘快捷键</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="关闭帮助"
          >
            ×
          </Button>
        </div>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span>上一步</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Alt + ←</kbd>
          </div>
          <div className="flex justify-between">
            <span>下一步</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Alt + →</kbd>
          </div>
          <div className="flex justify-between">
            <span>跳转到步骤 1-6</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">1-6</kbd>
          </div>
          <div className="flex justify-between">
            <span>第一步</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Home</kbd>
          </div>
          <div className="flex justify-between">
            <span>最后一步</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">End</kbd>
          </div>
          <div className="flex justify-between">
            <span>上一步 (按钮)</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Alt + P</kbd>
          </div>
          <div className="flex justify-between">
            <span>下一步 (按钮)</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Alt + N</kbd>
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t">
          <Button
            onClick={onClose}
            className="w-full"
          >
            知道了
          </Button>
        </div>
      </div>
    </div>
  );
});

KeyboardHelpModal.displayName = 'KeyboardHelpModal';