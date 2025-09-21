// apps/frontend/src/app/api/offers/route.ts
import { PrismaClient } from '@prisma/client';
import { getSession } from 'next-auth/react';
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth/v5-config"

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const offers = await prisma.offer.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return new Response(JSON.stringify(offers), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch offers:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { name, originalUrl } = await req.json();

        if (!name || !originalUrl) {
            return new Response(JSON.stringify({ error: 'Missing name or originalUrl' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        // Basic URL validation
        try {
            new URL(originalUrl);
        } catch (_) {
            return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const newOffer = await prisma.offer.create({
            data: {
                id: `offer_${Date.now()}`,
                userId: session.user.id,
                name,
                originalUrl,
                status: 'evaluating', // Default status
                createdAt: new Date(),
            },
        });

        return new Response(JSON.stringify(newOffer), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Failed to create offer:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
