import { SubscriptionHelper } from './subscription-helper';
import { TokenExpirationService } from './token-expiration-service';

/**
 * Cron job service for handling subscription-related tasks
 */
export class SubscriptionCronService {
  /**
   * Run all subscription-related cron jobs
   */
  static async runAllJobs() {
    console.log('Running subscription cron jobs...');
    
    try {
      // Process expired subscriptions and activate queued rewards
      const expiredResults = await SubscriptionHelper.processExpiredSubscriptions();
      console.log(`Processed ${expiredResults.length} expired subscriptions`);
      
      // Process monthly token allocation for invitation subscriptions
      const tokenResults = await SubscriptionHelper.processMonthlyTokenAllocation();
      console.log(`Processed monthly tokens for ${tokenResults.filter(r => r.status === 'allocated').length} subscriptions`);
      
      // Process expired tokens
      const expiredTokens = await TokenExpirationService.processExpiredSubscriptionTokens();
      console.log(`Processed expired tokens for ${expiredTokens?.processed?.length || 0} users`);
      
      return {
        expiredSubscriptions: expiredResults.length,
        monthlyTokens: tokenResults?.filter(r => r.status === 'allocated').length || 0,
        expiredTokens: expiredTokens?.processed?.length || 0
      };
    } catch (error) {
      console.error('Error running subscription cron jobs:', error);
      throw error;
    }
  }
  
  /**
   * Run daily at midnight to check for subscription expirations
   */
  static async dailyExpirationCheck() {
    console.log('Running daily expiration check...');
    
    try {
      const results = await SubscriptionHelper.processExpiredSubscriptions();
      console.log(`Daily check completed: ${results.length} subscriptions processed`);
      
      return results;
    } catch (error) {
      console.error('Error in daily expiration check:', error);
      throw error;
    }
  }
  
  /**
   * Run monthly to allocate tokens for invitation subscriptions
   */
  static async monthlyTokenAllocation() {
    console.log('Running monthly token allocation...');
    
    try {
      const results = await SubscriptionHelper.processMonthlyTokenAllocation();
      console.log(`Monthly allocation completed: ${results.filter(r => r.status === 'allocated').length} users received tokens`);
      
      return results;
    } catch (error) {
      console.error('Error in monthly token allocation:', error);
      throw error;
    }
  }
}