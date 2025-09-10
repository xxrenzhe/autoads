import { ScheduledTaskService } from '@/lib/services/scheduled-task-service'
import { TaskRecoveryService } from '@/lib/services/task-recovery-service'

// Initialize the scheduled task service when the module loads
const taskService = ScheduledTaskService.getInstance()

// Only initialize if not already initialized
if (taskService.getAllTasksStatus().length === 0) {
  // Initialize default tasks
  taskService.initializeDefaultTasks()
  
  // Start the service (async)
  taskService.start().then(() => {
    console.log('[ScheduledTaskService] Service initialized and started')
    
    // Initialize task recovery service
    TaskRecoveryService.initialize().catch(error => {
      console.error('[TaskRecoveryService] Failed to initialize:', error)
    })
  }).catch(error => {
    console.error('[ScheduledTaskService] Failed to start service:', error)
  })
} else {
  console.log('[ScheduledTaskService] Service already initialized')
}

export { taskService }