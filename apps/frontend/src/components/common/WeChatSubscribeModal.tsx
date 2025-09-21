"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';

export function WeChatSubscribeModal() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const showModal = searchParams.get('subscribe') === 'true';

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      router.back();
    }
  };

  return (
    <Dialog open={showModal} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>联系客服升级套餐</DialogTitle>
          <DialogDescription>
            请使用微信扫描下方二维码添加客服，我们将为您提供一对一的升级服务。
          </DialogDescription>
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
