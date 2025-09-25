// apps/frontend/src/lib/api/offers.ts

import type { Offer as OfferType, OfferCreateRequest } from '@/sdk/offer/client'
import { listOffers as sdkListOffers, createOffer as sdkCreateOffer } from '@/sdk/offer/client'

/**
 * Represents the data needed to create a new Offer.
 */
export type CreateOfferData = OfferCreateRequest

/**
 * Fetches the list of offers for the current user.
 * @returns A promise that resolves to an array of Offers.
 * @throws Will throw an error if the network request fails.
 */
export async function getOffers(): Promise<OfferType[]> { return sdkListOffers() }

/**
 * Creates a new offer for the current user.
 * @param offerData - The data for the new offer.
 * @returns A promise that resolves to the newly created Offer.
 * @throws Will throw an error if the network request fails.
 */
export async function createOffer(offerData: CreateOfferData): Promise<OfferType> {
  const evt = await sdkCreateOffer(offerData)
  // Map event to Offer shape for existing UI (optimistic)
  return {
    id: evt.offerId,
    userId: evt.userId,
    name: evt.name,
    originalUrl: evt.originalUrl,
    status: evt.status as any,
    createdAt: evt.createdAt as any,
  } as OfferType
}
