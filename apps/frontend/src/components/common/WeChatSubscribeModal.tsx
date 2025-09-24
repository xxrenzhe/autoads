"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';

type Props = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  scenario?: string
  requiredTokens?: number
  currentBalance?: number
}

export function WeChatSubscribeModal({ open, onOpenChange, scenario, requiredTokens, currentBalance }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const showModal = typeof open === 'boolean' ? open : (searchParams?.get('subscribe') === 'true');

  const handleOpenChange = (isOpen: boolean) => {
    if (onOpenChange) return onOpenChange(isOpen)
    if (!isOpen) router.back()
  }

  const renderTitle = () => {
    switch (scenario) {
      case 'insufficient_balance':
        return '余额不足，联系客服充值或升级套餐'
      case 'upgrade_required':
        return '功能受限，联系客服升级套餐'
      case 'adscenter_enable':
        return '启用引导：联系客服开通权限'
      default:
        return '联系客服升级套餐'
    }
  }

  const renderDesc = () => {
    if (scenario === 'insufficient_balance') {
      return (
        <>
          当前余额：{currentBalance ?? 0}，本次需要：{requiredTokens ?? 0}。请添加客服获取充值或升级指引。
        </>
      )
    }
    if (scenario === 'adscenter_enable') {
      return '添加客服以启用 AdsCenter 所需权限与配置信息。'
    }
    if (scenario === 'upgrade_required') {
      return '当前功能需要更高等级套餐，请联系客户成功升级。'
    }
    return '请使用微信扫描下方二维码添加客服，我们将为您提供一对一的升级服务。'
  }

  return (
    <Dialog open={showModal} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{renderTitle()}</DialogTitle>
          <DialogDescription>{renderDesc()}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center mt-4">
          <Image src="/Customer-service-QR-code.jpg" alt="客服二维码" width={200} height={200} />
        </div>
        <div className="mt-2 text-center text-sm text-gray-500">
          <p>添加时请备注“套餐升级”</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
