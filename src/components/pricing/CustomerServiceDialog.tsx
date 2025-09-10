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

interface CustomerServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planName: string
}

export default function CustomerServiceDialog({ 
  open, 
  onOpenChange, 
  planName 
}: CustomerServiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            联系客服订阅{planName}套餐
          </DialogTitle>
          <DialogDescription className="text-center">
            请扫码添加客服微信，我们将为您提供专业的订阅服务
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
                // 如果图片加载失败，显示占位符
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                target.parentElement!.innerHTML = `
                  <div class="w-full h-full flex items-center justify-center bg-gray-200">
                    <span class="text-gray-500">客服二维码</span>
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