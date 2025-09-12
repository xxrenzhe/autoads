'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Badge } from '../ui/badge'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { 
  CreditCard, 
  Calendar, 
  Plus,
  Edit,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

interface Plan {
  id: string
  name: string
  displayName: string
  description: string
  price: number
  currency: string
  interval: 'MONTH' | 'YEAR'
  tokenQuota: number
  isActive: boolean
  trialDays?: number
}

interface Subscription {
  id: string
  plan: string
  status: 'active' | 'cancelled' | 'expired' | 'past_due'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
}

interface UserSubscriptionManagerProps {
  userId: string
  currentSubscription?: Subscription | null
  onSubscriptionChange?: () => void
}

export function UserSubscriptionManager({ 
  userId, 
  currentSubscription, 
  onSubscriptionChange 
}: UserSubscriptionManagerProps) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  const [duration, setDuration] = useState<number>(1)
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [isModifying, setIsModifying] = useState(false)
  const [extendDays, setExtendDays] = useState<number>(0)
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [showModifyForm, setShowModifyForm] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  React.useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/admin/plans?action=list&includeInactive=false')
      const data = await response.json()
      if (data.success) {
        setPlans(data.data.plans)
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error)
    }
  }

  const assignSubscription = async () => {
    if (!selectedPlan) {
      setMessage({ type: 'error', text: 'Please select a plan' })
      return
    }

    setIsAssigning(true)
    setMessage(null)

    try {
      const payload: any = {
        planId: selectedPlan,
        notes
      }

      if (customEndDate) {
        payload.customEndDate = customEndDate
      } else {
        payload.duration = duration
      }

      const response = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'Subscription assigned successfully' })
        setShowAssignForm(false)
        setSelectedPlan('')
        setDuration(1)
        setCustomEndDate('')
        setNotes('')
        onSubscriptionChange?.()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to assign subscription' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setIsAssigning(false)
    }
  }

  const modifySubscription = async () => {
    if (!currentSubscription) return

    setIsModifying(true)
    setMessage(null)

    try {
      const payload: any = {
        subscriptionId: currentSubscription.id,
        notes
      }

      if (extendDays > 0) {
        payload.extendDays = extendDays
      }

      const response = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'Subscription modified successfully' })
        setShowModifyForm(false)
        setExtendDays(0)
        setNotes('')
        onSubscriptionChange?.()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to modify subscription' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setIsModifying(false)
    }
  }

  const cancelSubscription = async () => {
    if (!currentSubscription || !confirm('Are you sure you want to cancel this subscription?')) {
      return
    }

    setIsModifying(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: currentSubscription.id,
          cancelImmediately: true,
          notes: 'Cancelled by admin'
        })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'Subscription cancelled successfully' })
        onSubscriptionChange?.()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to cancel subscription' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setIsModifying(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getPlanDisplayName = (planName: string) => {
    const plan = plans.find(p => p.name.toLowerCase() === planName.toLowerCase())
    return plan?.displayName || planName
  }

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 mr-2" />
            )}
            {message.text}
          </div>
        </div>
      )}

      {/* Current Subscription */}
      {currentSubscription ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <CreditCard className="h-5 w-5 mr-2" />
                Current Subscription
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModifyForm(!showModifyForm)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Modify
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={cancelSubscription}
                  disabled={isModifying}
                >
                  Cancel
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Plan</Label>
                <p className="text-lg font-semibold">
                  {getPlanDisplayName(currentSubscription.plan)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Status</Label>
                <Badge variant={
                  currentSubscription.status === 'active' ? 'success' :
                  currentSubscription.status === 'cancelled' ? 'warning' :
                  currentSubscription.status === 'expired' ? 'destructive' : 'secondary'
                }>
                  {currentSubscription.status}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Current Period</Label>
                <p className="text-sm text-gray-900">
                  {formatDate(currentSubscription.currentPeriodStart)} - {' '}
                  {formatDate(currentSubscription.currentPeriodEnd)}
                </p>
              </div>
              {currentSubscription.cancelAtPeriodEnd && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Cancels At</Label>
                  <p className="text-sm text-orange-600">
                    {formatDate(currentSubscription.currentPeriodEnd)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Active Subscription
            </h3>
            <p className="text-gray-600 mb-4">
              This user is on the free plan
            </p>
            <Button onClick={() => setShowAssignForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Assign Subscription
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Assign Subscription Form */}
      {showAssignForm && (
        <Card>
          <CardHeader>
            <CardTitle>Assign New Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="plan-select">Select Plan</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.filter(p => p.isActive).map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.displayName} - ¥{plan.price}/{plan.interval.toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="duration">Duration (months)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                  disabled={!!customEndDate}
                />
              </div>
              <div>
                <Label htmlFor="custom-end-date">OR Custom End Date</Label>
                <Input
                  id="custom-end-date"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this subscription assignment..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={assignSubscription}
                disabled={isAssigning || !selectedPlan}
              >
                {isAssigning ? 'Assigning...' : 'Assign Subscription'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAssignForm(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modify Subscription Form */}
      {showModifyForm && currentSubscription && (
        <Card>
          <CardHeader>
            <CardTitle>Modify Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="extend-days">Extend by Days</Label>
              <Input
                id="extend-days"
                type="number"
                min="1"
                value={extendDays}
                onChange={(e) => setExtendDays(parseInt(e.target.value) || 0)}
                placeholder="Number of days to extend"
              />
            </div>

            <div>
              <Label htmlFor="modify-notes">Notes (optional)</Label>
              <Textarea
                id="modify-notes"
                placeholder="Add any notes about this modification..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={modifySubscription}
                disabled={isModifying || extendDays <= 0}
              >
                {isModifying ? 'Modifying...' : 'Extend Subscription'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowModifyForm(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}