'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { getOffers, createOffer, CreateOfferData } from '@/lib/api/offers';
import { Offer } from '@/types/common';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Loader2 } from 'lucide-react';

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State for the new offer form
  const [newOfferName, setNewOfferName] = useState('');
  const [newOfferUrl, setNewOfferUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);


  const fetchOffers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getOffers();
      setOffers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load offers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    if (!newOfferName || !newOfferUrl) {
      setFormError('Both name and URL are required.');
      setIsSubmitting(false);
      return;
    }

    try {
      const newOfferData: CreateOfferData = { name: newOfferName, originalUrl: newOfferUrl };
      await createOffer(newOfferData);
      
      // Reset form and close modal
      setNewOfferName('');
      setNewOfferUrl('');
      setIsModalOpen(false);
      
      // Refresh the offers list
      await fetchOffers(); 
    } catch (err: any) {
      setFormError(err.message || 'Failed to create offer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-2">Loading Offers...</p>
        </div>
      );
    }

    if (error) {
      return <p className="text-red-500 text-center py-10">{error}</p>;
    }

    if (offers.length === 0) {
      return <p className="text-center text-muted-foreground py-10">No offers found. Create your first one!</p>;
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Original URL</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {offers.map((offer) => (
            <TableRow key={offer.id}>
              <TableCell className="font-medium">
                <a className="text-blue-600 underline" href={`/offers/${offer.id}`}>{offer.name}</a>
              </TableCell>
              <TableCell>{offer.originalUrl}</TableCell>
              <TableCell>{offer.status}</TableCell>
              <TableCell>{new Date(offer.createdAt).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Offer Library</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Offer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create a New Offer</DialogTitle>
              <DialogDescription>
                Enter the details for your new offer. It will start in the 'evaluating' state.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={newOfferName}
                    onChange={(e) => setNewOfferName(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g., Summer Sale Campaign"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="url" className="text-right">
                    URL
                  </Label>
                  <Input
                    id="url"
                    value={newOfferUrl}
                    onChange={(e) => setNewOfferUrl(e.target.value)}
                    className="col-span-3"
                    placeholder="https://example.com/offer"
                    type="url"
                    disabled={isSubmitting}
                  />
                </div>
                {formError && (
                    <p className="text-red-500 text-sm col-span-4 text-center">{formError}</p>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary" disabled={isSubmitting}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Offer
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="border rounded-lg">
        {renderContent()}
      </div>
    </div>
  );
}
