'use client'

import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { MainNavigation } from "@/components/navigation/MainNavigation"
import { PageFooter } from "@/components/PageFooter"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

// A simple fetcher function
const fetcher = (url: string) => fetch(url).then(res => res.json())

function SubscriptionCard() {
  const { data, error, isLoading } = useSWR('/api/billing/subscription', fetcher)

  if (isLoading) return <Skeleton className="h-48 w-full" />
  if (error) return <div>Failed to load subscription.</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Subscription</CardTitle>
        <CardDescription>Your current plan and status.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Plan</span>
          <span className="font-semibold">{data.planName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status</span>
          <span className="font-semibold capitalize">{data.status}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Renews on</span>
          <span className="font-semibold">{new Date(data.currentPeriodEnd).toLocaleDateString()}</span>
        </div>
        <Button className="w-full">Contact Support to Upgrade</Button>
      </CardContent>
    </Card>
  )
}

function TokenCard() {
  const { data, error, isLoading } = useSWR('/api/billing/token', fetcher)

  if (isLoading) return <Skeleton className="h-48 w-full" />
  if (error) return <div>Failed to load token balance.</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Tokens</CardTitle>
        <CardDescription>Your available token balance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className="text-4xl font-bold">{data.balance}</p>
          <p className="text-sm text-muted-foreground">Tokens available</p>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          Last updated: {new Date(data.updatedAt).toLocaleString()}
        </p>
        <Button className="w-full">Purchase More Tokens</Button>
      </CardContent>
    </Card>
  )
}


export default function BillingPage() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "unauthenticated") {
    return <div>Please sign in to view your billing information.</div>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <MainNavigation />
      <main className="flex-grow container py-8">
        <h1 className="text-3xl font-bold mb-6">Billing Center</h1>
        <div className="grid gap-6 md:grid-cols-2">
          <SubscriptionCard />
          <TokenCard />
        </div>
      </main>
      <PageFooter />
    </div>
  )
}
