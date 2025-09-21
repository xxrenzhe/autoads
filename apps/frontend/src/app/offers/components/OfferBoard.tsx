"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, RefreshCw } from 'lucide-react';
import { OfferCard } from './OfferCard';
import { CreateOfferModal } from './CreateOfferModal';

// Mock Offer type for now
type Offer = {
  id: string;
  name: string;
  originalUrl: string;
  status: string;
  siterankScore?: number;
  createdAt: string;
};

export function OfferBoard() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);

  async function fetchOffers() {
    if (!isRefreshing) setLoading(true);
    try {
      const response = await fetch('/api/offers');
      if (!response.ok) {
        throw new Error('Failed to fetch offers');
      }
      const data = await response.json();
      setOffers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchOffers();
  };

  useEffect(() => {
    fetchOffers();
    // Set up polling every 15 seconds
    const intervalId = setInterval(fetchOffers, 15000);

    // Clear interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const handleOfferCreated = (newOffer: Offer) => {
    setOffers(prevOffers => [newOffer, ...prevOffers]);
    fetchOffers(); 
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">我的Offer库</h1>
        <div className="flex items-center space-x-2">
            <Button onClick={handleRefresh} variant="outline" disabled={isRefreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                刷新
            </Button>
            <Button onClick={() => setModalOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> 新建 Offer
            </Button>
        </div>
      </div>

      {offers.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-lg">
          <p className="text-gray-500">您还没有任何Offer。</p>
          <p className="mt-2">点击“新建 Offer”开始创建您的第一个推广活动吧！</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map(offer => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}

      <CreateOfferModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        onOfferCreated={handleOfferCreated}
      />
    </div>
  );
}
