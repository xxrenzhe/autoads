// apps/frontend/src/lib/api/offers.ts

import { Offer } from '@/types/common'; // Assuming a common type definition exists

/**
 * Represents the data needed to create a new Offer.
 */
export type CreateOfferData = {
  name: string;
  originalUrl: string;
};

/**
 * Fetches the list of offers for the current user.
 * @returns A promise that resolves to an array of Offers.
 * @throws Will throw an error if the network request fails.
 */
export async function getOffers(): Promise<Offer[]> {
  const response = await fetch('/api/offers', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch offers' }));
    throw new Error(errorData.message || 'An unknown error occurred');
  }

  return response.json();
}

/**
 * Creates a new offer for the current user.
 * @param offerData - The data for the new offer.
 * @returns A promise that resolves to the newly created Offer.
 * @throws Will throw an error if the network request fails.
 */
export async function createOffer(offerData: CreateOfferData): Promise<Offer> {
  const response = await fetch('/api/offers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(offerData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to create offer' }));
    throw new Error(errorData.message || 'An unknown error occurred');
  }

  return response.json();
}
