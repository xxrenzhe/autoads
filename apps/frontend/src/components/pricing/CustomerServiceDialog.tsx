'use client';

import React from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface CustomerServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CustomerServiceDialog({ open, onOpenChange }: CustomerServiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>联系客服订阅</DialogTitle>
          <DialogDescription>
            请扫描下方的二维码添加我们的客服。我们的团队将为您提供一对一的咨询和开通服务。
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center p-4">
          <Image
            src="/Customer-service-QR-code.jpg" // Assuming the QR code image is in the `public` directory
            alt="Customer Service QR Code"
            width={250}
            height={250}
            className="rounded-lg"
          />
        </div>
        <div className="text-center text-sm text-muted-foreground">
          <p>添加时请备注 "AutoAds订阅咨询"</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
