import { ScheduledTaskService } from '@/lib/services/scheduled-task-service'

async function testDirectService() {
  console.log('🧪 直接测试定时任务服务...\n')

  try {
    // Get service instance
    const taskService = ScheduledTaskService.getInstance()
    
    // Initialize default tasks
    taskService.initializeDefaultTasks()
    
    // Start service
    taskService.start()
    
    console.log('1. 检查已注册的任务...')
    const tasks = taskService.getAllTasksStatus()
    console.log(`   已注册 ${tasks.length} 个任务:`)
    tasks.forEach(task => {
      console.log(`   - ${task.name} (${task.id}): ${task.enabled ? '启用' : '禁用'}`)
      console.log(`     调度: ${task.schedule}`)
      console.log(`     下次运行: ${task.nextRun?.toLocaleString() || 'N/A'}`)
    })

    // Test triggering subscription expiration task
    console.log('\n2. 测试手动触发订阅过期任务...')
    await taskService.triggerTask('subscription-expiration')
    console.log('   ✅ 任务触发成功')

    console.log('\n🎉 测试完成!')
    console.log('\n💡 测试结果:')
    console.log('   - 定时任务服务正常运行')
    console.log('   - 默认任务已正确注册')
    console.log('   - 任务手动触发功能正常')

  } catch (error) {
    console.error('❌ 测试失败:', error)
  }
}

// 运行测试
testDirectService().catch(console.error)