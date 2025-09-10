import { google } from 'googleapis'
import { configService } from './config-service'

class GmailService {
  private oauth2Client: any = null

  private async getAuthenticatedClient() {
    if (this.oauth2Client) {
      return this.oauth2Client
    }

    // Get OAuth configuration
    const config = await configService.get('gmail_oauth')
    const tokens = await configService.get('gmail_oauth_tokens')

    if (!config || !tokens || !config.enabled) {
      throw new Error('Gmail OAuth is not configured or enabled')
    }

    if (!tokens.access_token) {
      throw new Error('No valid access token found')
    }

    // Create OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    )

    // Set credentials
    this.oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      expiry_date: tokens.expiry_date
    })

    // Handle token refresh
    this.oauth2Client.on('tokens', async (newTokens: any) => {
      console.log('Gmail tokens refreshed')
      
      // Update stored tokens
      await configService.set('gmail_oauth_tokens', {
        ...tokens,
        ...newTokens,
        last_refresh: new Date().toISOString()
      }, 'system')
    })

    return this.oauth2Client
  }

  async getUserProfile() {
    const auth = await this.getAuthenticatedClient()
    const gmail = google.gmail({ version: 'v1', auth })
    
    const response = await gmail.users.getProfile({ userId: 'me' })
    return response.data
  }

  async getLabels() {
    const auth = await this.getAuthenticatedClient()
    const gmail = google.gmail({ version: 'v1', auth })
    
    const response = await gmail.users.labels.list({ userId: 'me' })
    return response.data.labels || []
  }

  async getMessages(options: {
    maxResults?: number
    q?: string
    labelIds?: string[]
    includeSpamTrash?: boolean
  } = {}) {
    const auth = await this.getAuthenticatedClient()
    const gmail = google.gmail({ version: 'v1', auth })
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: options.maxResults || 10,
      q: options.q,
      labelIds: options.labelIds,
      includeSpamTrash: options.includeSpamTrash || false
    })
    
    return response.data.messages || []
  }

  async getMessage(messageId: string, format: 'minimal' | 'full' | 'raw' | 'metadata' = 'full') {
    const auth = await this.getAuthenticatedClient()
    const gmail = google.gmail({ version: 'v1', auth })
    
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format
    })
    
    return response.data
  }

  async getThreads(options: {
    maxResults?: number
    q?: string
    labelIds?: string[]
    includeSpamTrash?: boolean
  } = {}) {
    const auth = await this.getAuthenticatedClient()
    const gmail = google.gmail({ version: 'v1', auth })
    
    const response = await gmail.users.threads.list({
      userId: 'me',
      maxResults: options.maxResults || 10,
      q: options.q,
      labelIds: options.labelIds,
      includeSpamTrash: options.includeSpamTrash || false
    })
    
    return response.data.threads || []
  }

  async getThread(threadId: string, format: 'minimal' | 'full' | 'metadata' = 'full') {
    const auth = await this.getAuthenticatedClient()
    const gmail = google.gmail({ version: 'v1', auth })
    
    const response = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format
    })
    
    return response.data
  }

  async sendMessage(message: {
    to: string
    subject: string
    body: string
    html?: string
    cc?: string
    bcc?: string
    replyTo?: string
  }) {
    const auth = await this.getAuthenticatedClient()
    const gmail = google.gmail({ version: 'v1', auth })

    // Create email message
    const emailLines = [
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      message.cc ? `Cc: ${message.cc}` : '',
      message.bcc ? `Bcc: ${message.bcc}` : '',
      message.replyTo ? `Reply-To: ${message.replyTo}` : '',
      'Content-Type: text/html; charset=utf-8',
      '',
      message.html || message.body
    ].filter(line => line !== '')

    const email = emailLines.join('\r\n')
    const encodedEmail = Buffer.from(email).toString('base64url')

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail
      }
    })

    return response.data
  }

  async createDraft(message: {
    to: string
    subject: string
    body: string
    html?: string
    cc?: string
    bcc?: string
  }) {
    const auth = await this.getAuthenticatedClient()
    const gmail = google.gmail({ version: 'v1', auth })

    // Create email message
    const emailLines = [
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      message.cc ? `Cc: ${message.cc}` : '',
      message.bcc ? `Bcc: ${message.bcc}` : '',
      'Content-Type: text/html; charset=utf-8',
      '',
      message.html || message.body
    ].filter(line => line !== '')

    const email = emailLines.join('\r\n')
    const encodedEmail = Buffer.from(email).toString('base64url')

    const response = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: encodedEmail
        }
      }
    })

    return response.data
  }

  async searchMessages(query: string, maxResults: number = 10) {
    return this.getMessages({
      q: query,
      maxResults
    })
  }

  async getUnreadCount() {
    const labels = await this.getLabels()
    const inboxLabel = labels.find(label => label.id === 'INBOX')
    return inboxLabel?.messagesUnread || 0
  }

  async markAsRead(messageId: string) {
    const auth = await this.getAuthenticatedClient()
    const gmail = google.gmail({ version: 'v1', auth })
    
    const response = await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD']
      }
    })
    
    return response.data
  }

  async markAsUnread(messageId: string) {
    const auth = await this.getAuthenticatedClient()
    const gmail = google.gmail({ version: 'v1', auth })
    
    const response = await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: ['UNREAD']
      }
    })
    
    return response.data
  }

  async addLabel(messageId: string, labelId: string) {
    const auth = await this.getAuthenticatedClient()
    const gmail = google.gmail({ version: 'v1', auth })
    
    const response = await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [labelId]
      }
    })
    
    return response.data
  }

  async removeLabel(messageId: string, labelId: string) {
    const auth = await this.getAuthenticatedClient()
    const gmail = google.gmail({ version: 'v1', auth })
    
    const response = await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: [labelId]
      }
    })
    
    return response.data
  }

  // Clear cached client (useful for testing or when tokens change)
  clearCache() {
    this.oauth2Client = null
  }

  // Health check method
  async healthCheck() {
    try {
      const profile = await this.getUserProfile()
      return {
        status: 'healthy',
        userEmail: profile.emailAddress,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : "Unknown error" as any,
        timestamp: new Date().toISOString()
      }
    }
  }
}

export const gmailService = new GmailService()