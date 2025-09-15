'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/Switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { Textarea } from '../../components/ui/textarea'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/ui/tabs'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/Dialog'
import {
  Mail,
  Send,
  Settings as SettingsIcon,
  Shield,
  Bell,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

interface EmailConfig {
  provider: string
  smtp: {
    host: string
    port: number
    secure: boolean
    user: string
    pass: string
  }
  from: string
  fromName: string
  enabled: boolean
  rateLimit: number
  maxRetries: number
  events: {
    userRegistration: boolean
    passwordReset: boolean
    subscriptionCreated: boolean
    subscriptionExpired: boolean
    paymentFailed: boolean
    tokenLow: boolean
  }
  dkim: {
    domain: string
    selector: string
    privateKey: string
  }
}

export function EmailConfigEnhanced() {
  const [config, setConfig] = useState<EmailConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reloadStatus, setReloadStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testData, setTestData] = useState({
    to: '',
    subject: 'Test Email from AutoAds',
    template: 'test'
  })

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const response = await fetch('/ops/api/v1/console/email-config')
      if (response.ok) {
        const data = await response.json()
        setConfig(data.emailConfig)
      }
    } catch (error) {
      toast.error('Failed to fetch email configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config) return

    setSaving(true)
    try {
      const response = await fetch('/ops/api/v1/console/email-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailConfig: config }),
      })

      if (response.ok) {
        toast.success('Email configuration saved')
        setReloadStatus('pending')
        
        // Simulate reload
        setTimeout(() => {
          setReloadStatus('success')
          setTimeout(() => setReloadStatus('idle'), 3000)
        }, 1000)
      } else {
        toast.error('Failed to save email configuration')
      }
    } catch (error) {
      toast.error('Failed to save email configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleTestEmail = async () => {
    if (!testData.to || !testData.subject) {
      toast.error('Recipient and subject are required')
      return
    }

    try {
      const response = await fetch('/ops/api/v1/console/email-config/test', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      })

      if (response.ok) {
        toast.success('Test email sent successfully')
        setTestDialogOpen(false)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to send test email')
      }
    } catch (error) {
      toast.error('Failed to send test email')
    }
  }

  const updateConfig = (path: string, value: any) => {
    if (!config) return
    
    setConfig(prev => {
      const newConfig = { ...prev! }
      const keys = path.split('.')
      let current: any = newConfig
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] }
        current = current[keys[i]]
      }
      
      current[keys[keys.length - 1]] = value
      return newConfig
    })
  }

  if (!config) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                Email Configuration
              </CardTitle>
              <CardDescription>
                Configure email service settings and notification preferences
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              {reloadStatus !== 'idle' && (
                <div className="flex items-center space-x-1 mr-2">
                  {reloadStatus === 'pending' && (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-yellow-500" />
                      <span className="text-sm text-yellow-600">Reloading...</span>
                    </>
                  )}
                  {reloadStatus === 'success' && (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600">Reloaded</span>
                    </>
                  )}
                  {reloadStatus === 'error' && (
                    <>
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600">Failed</span>
                    </>
                  )}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchConfig}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Send className="h-4 w-4 mr-2" />
                    Test Email
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send Test Email</DialogTitle>
                    <DialogDescription>
                      Send a test email to verify your configuration
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="to" className="text-right">
                        To *
                      </Label>
                      <Input
                        id="to"
                        type="email"
                        value={testData.to}
                        onChange={(e) => setTestData({ ...testData, to: (e.target as any).value })}
                        className="col-span-3"
                        placeholder="test@example.com"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="subject" className="text-right">
                        Subject *
                      </Label>
                      <Input
                        id="subject"
                        value={testData.subject}
                        onChange={(e) => setTestData({ ...testData, subject: (e.target as any).value })}
                        className="col-span-3"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleTestEmail}>
                      Send Test
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="smtp" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="smtp">SMTP Settings</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>
            
            <TabsContent value="smtp" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <SettingsIcon className="h-5 w-5 mr-2" />
                    SMTP Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="provider">Provider</Label>
                      <Select
                        value={config.provider}
                        onValueChange={(value) => updateConfig('provider', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="smtp">Custom SMTP</SelectItem>
                          <SelectItem value="sendgrid">SendGrid</SelectItem>
                          <SelectItem value="ses">Amazon SES</SelectItem>
                          <SelectItem value="mailgun">Mailgun</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="from">From Email</Label>
                      <Input
                        id="from"
                        type="email"
                        value={config.from}
                        onChange={(e) => updateConfig('from', (e.target as any).value)}
                        placeholder="noreply@example.com"
                      />
                    </div>
                  </div>

                  {config.provider === 'smtp' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="host">SMTP Host</Label>
                          <Input
                            id="host"
                            value={config.smtp.host}
                            onChange={(e) => updateConfig('smtp.host', (e.target as any).value)}
                            placeholder="smtp.example.com"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="port">Port</Label>
                          <Input
                            id="port"
                            type="number"
                            value={config.smtp.port}
                            onChange={(e) => updateConfig('smtp.port', parseInt(e.target.value))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="user">Username</Label>
                          <Input
                            id="user"
                            value={config.smtp.user}
                            onChange={(e) => updateConfig('smtp.user', e.target.value)}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="pass">Password</Label>
                          <Input
                            id="pass"
                            type="password"
                            value={config.smtp.pass}
                            onChange={(e) => updateConfig('smtp.pass', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="secure"
                          checked={config.smtp.secure}
                          onCheckedChange={(checked: boolean) => updateConfig('smtp.secure', checked)}
                        />
                        <Label htmlFor="secure">Use SSL/TLS</Label>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Bell className="h-5 w-5 mr-2" />
                    Email Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enabled"
                      checked={config.enabled}
                      onCheckedChange={(checked: boolean) => updateConfig('enabled', checked)}
                    />
                    <Label htmlFor="enabled">Enable email notifications</Label>
                  </div>

                  {config.enabled && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="rateLimit">Rate Limit (emails/minute)</Label>
                          <Input
                            id="rateLimit"
                            type="number"
                            value={config.rateLimit}
                            onChange={(e) => updateConfig('rateLimit', parseInt(e.target.value))}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="maxRetries">Max Retries</Label>
                          <Input
                            id="maxRetries"
                            type="number"
                            value={config.maxRetries}
                            onChange={(e) => updateConfig('maxRetries', parseInt(e.target.value))}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-medium">Notification Events</h4>
                        
                        <div className="flex items-center justify-between">
                          <Label htmlFor="userRegistration">User Registration</Label>
                          <Switch
                            id="userRegistration"
                            checked={config.events.userRegistration}
                            onCheckedChange={(checked: boolean) => updateConfig('events.userRegistration', checked)}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Label htmlFor="passwordReset">Password Reset</Label>
                          <Switch
                            id="passwordReset"
                            checked={config.events.passwordReset}
                            onCheckedChange={(checked: boolean) => updateConfig('events.passwordReset', checked)}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Label htmlFor="subscriptionCreated">Subscription Created</Label>
                          <Switch
                            id="subscriptionCreated"
                            checked={config.events.subscriptionCreated}
                            onCheckedChange={(checked: boolean) => updateConfig('events.subscriptionCreated', checked)}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Label htmlFor="subscriptionExpired">Subscription Expired</Label>
                          <Switch
                            id="subscriptionExpired"
                            checked={config.events.subscriptionExpired}
                            onCheckedChange={(checked: boolean) => updateConfig('events.subscriptionExpired', checked)}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Label htmlFor="paymentFailed">Payment Failed</Label>
                          <Switch
                            id="paymentFailed"
                            checked={config.events.paymentFailed}
                            onCheckedChange={(checked: boolean) => updateConfig('events.paymentFailed', checked)}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Label htmlFor="tokenLow">Low Token Balance</Label>
                          <Switch
                            id="tokenLow"
                            checked={config.events.tokenLow}
                            onCheckedChange={(checked: boolean) => updateConfig('events.tokenLow', checked)}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    Security Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>DKIM Configuration</AlertTitle>
                    <AlertDescription>
                      Configure DKIM to improve email deliverability and prevent spam marking.
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="domain">Domain</Label>
                      <Input
                        id="domain"
                        value={config.dkim.domain}
                        onChange={(e) => updateConfig('dkim.domain', e.target.value)}
                        placeholder="example.com"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="selector">Selector</Label>
                      <Input
                        id="selector"
                        value={config.dkim.selector}
                        onChange={(e) => updateConfig('dkim.selector', e.target.value)}
                        placeholder="default"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="privateKey">Private Key</Label>
                    <Textarea
                      id="privateKey"
                      value={config.dkim.privateKey}
                      onChange={(e) => updateConfig('dkim.privateKey', e.target.value)}
                      rows={6}
                      placeholder="-----BEGIN RSA PRIVATE KEY-----"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
