'use client'

import React from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Scenario = 'insufficient_balance' | 'upgrade_required' | 'adscenter_enable' | 'batchopen_entry'

interface WeChatSubscribeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scenario: Scenario
  planName?: string
  requiredTokens?: number
  currentBalance?: number
}

function getTexts(props: WeChatSubscribeModalProps) {
  const { scenario, planName, requiredTokens, currentBalance } = props
  switch (scenario) {
    case 'insufficient_balance':
      return {
        title: '余额不足，联系顾问快速充值',
        description: `本次预计消耗 ${requiredTokens ?? '-'} Token，当前余额 ${currentBalance ?? '-'}。` +
          ' 添加客服微信，说明账户邮箱与需求，运营将尽快为你开通/充值。'
      }
    case 'upgrade_required':
      return {
        title: '升级套餐以解锁该功能',
        description: `当前套餐不包含此功能${planName ? `（建议：${planName}）` : ''}。添加客服微信，告知账户邮箱与目标套餐，运营将协助开通。`
      }
    case 'adscenter_enable':
      return {
        title: '启用 AdsCenter 自动化',
        description: '请联系顾问完成 Ads 账户配置与首次初始化，确保执行稳定可靠。'
      }
    case 'batchopen_entry':
      return {
        title: '开通静默/自动化访问',
        description: '根据场景推荐批量访问能力（静默/自动化/定时），添加客服获取最佳实践与开通支持。'
      }
    default:
      return {
        title: planName ? `联系顾问订阅${planName}套餐` : '联系顾问获取支持',
        description: '请扫码添加客服微信，我们将为您提供专业的服务'
      }
  }
}

export default function WeChatSubscribeModal(props: WeChatSubscribeModalProps) {
  const { open, onOpenChange } = props
  const texts = getTexts(props)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {texts.title}
          </DialogTitle>
          <DialogDescription className="text-center">
            {texts.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4 py-6">
          <div className="relative w-48 h-48 bg-gray-100 rounded-lg overflow-hidden">
            <Image
              src="/Customer-service-QR-code.jpg"
              alt="客服二维码"
              fill
              className="object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                target.parentElement!.innerHTML = `
                  <div class=\"w-full h-full flex items-center justify-center bg-gray-200\"> 
                    <span class=\"text-gray-500\">客服二维码</span>
                  </div>
                `
              }}
            />
          </div>
          
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              扫描二维码或搜索微信号：<span className="font-semibold">xxrenzhe11</span>
            </p>
            <p className="text-xs text-gray-500">
              客服工作时间：周一至周五 9:00-18:00
            </p>
          </div>
        </div>
        
        <div className="flex justify-center">
          <Button 
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            我知道了
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

