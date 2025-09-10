import { SubscriptionExpirationService } from './subscription-expiration-service';
import { TokenExpirationService } from './token-expiration-service';

/**
 * Cron Job Manager
 * 
 * Centralized service to manage all scheduled tasks
 */
export class CronJobManager {
  private static isInitialized = false;

  /**
   * Initialize all cron jobs
   */
  static initialize() {
    if (this.isInitialized) {
      console.log('⚠️ Cron jobs already initialized');
      return;
    }

    console.log('🚀 Initializing cron jobs...');

    // Start subscription expiration check
    SubscriptionExpirationService.startExpirationCheck();

    // Start token expiration check (if it exists)
    if (TokenExpirationService.startTokenCleanup) {
      TokenExpirationService.startTokenCleanup();
    }

    this.isInitialized = true;
    console.log('✅ All cron jobs initialized');
  }

  /**
   * Stop all cron jobs
   */
  static shutdown() {
    if (!this.isInitialized) {
      return;
    }

    console.log('🛑 Shutting down cron jobs...');

    // Stop subscription expiration check
    SubscriptionExpirationService.stopExpirationCheck();

    // Stop token expiration check (if it exists)
    if (TokenExpirationService.stopTokenCleanup) {
      TokenExpirationService.stopTokenCleanup();
    }

    this.isInitialized = false;
    console.log('✅ All cron jobs stopped');
  }

  /**
   * Get status of all cron jobs
   */
  static getStatus() {
    return {
      initialized: this.isInitialized,
      jobs: [
        {
          name: 'subscription_expiration_check',
          status: this.isInitialized ? 'running' : 'stopped',
          description: 'Daily check for expired subscriptions at 2:00 AM'
        },
        {
          name: 'token_cleanup',
          status: this.isInitialized ? 'running' : 'stopped',
          description: 'Daily cleanup of expired tokens'
        }
      ]
    };
  }
}