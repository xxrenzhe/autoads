import { AutoClickScheduler } from '@/lib/autoclick-scheduler';
import { AutoClickService } from '@/lib/autoclick-service';

let scheduler: AutoClickScheduler | null = null;

// Initialize the scheduler when the module loads
if (!scheduler) {
  scheduler = AutoClickScheduler.getInstance();
  scheduler.start();
  console.log('[AutoClickScheduler] Service initialized and started');
  
  // Initialize task recovery service
  const autoClickService = new AutoClickService();
  autoClickService.recoverTasks().then(() => {
    console.log('[AutoClickRecovery] Service initialized and recovered tasks');
  }).catch(error => {
    console.error('[AutoClickRecovery] Failed to initialize recovery service:', error);
  });
}

export function initAutoClickScheduler() {
  if (!scheduler) {
    scheduler = AutoClickScheduler.getInstance();
    scheduler.start();
  }
  return scheduler;
}

export function getAutoClickScheduler() {
  return scheduler;
}

export function stopAutoClickScheduler() {
  if (scheduler) {
    scheduler.stop();
    scheduler = null;
  }
}

// Export for module usage
export { scheduler };