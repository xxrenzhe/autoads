// apps/frontend/src/app/offers/components/CreateOfferModal.tsx
"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Offer = {
    id: string;
    name: string;
    originalUrl: string;
    status: string;
    siterankScore?: number;
    createdAt: string;
};

type CreateOfferModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onOfferCreated: (newOffer: Offer) => void;
};

export function CreateOfferModal({ isOpen, onClose, onOfferCreated }: CreateOfferModalProps) {
  const [name, setName] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!name || !originalUrl) {
      setError('名称和URL不能为空');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, originalUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '创建失败');
      }

      const newOffer = await response.json();
      onOfferCreated(newOffer);
      onClose();
      // Reset form
      setName('');
      setOriginalUrl('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建 Offer</DialogTitle>
          <DialogDescription>
            输入您的Offer名称和目标URL，开始您的推广活动。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                名称
                </Label>
                <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                placeholder="例如: [US] My Awesome Product"
                />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="url" className="text-right">
                原始URL
                </Label>
                <Input
                id="url"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                className="col-span-3"
                placeholder="https://example.com/my-offer"
                type="url"
                />
            </div>
            </div>
            {error && <p className="text-red-500 text-sm text-center pb-4">{error}</p>}
            <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                取消
            </Button>
            <Button type="submit" disabled={loading}>
                {loading ? '创建中...' : '创建'}
            </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
