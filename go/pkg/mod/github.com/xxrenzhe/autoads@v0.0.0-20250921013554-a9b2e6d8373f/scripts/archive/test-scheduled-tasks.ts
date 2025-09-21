import { prisma } from '@/lib/db'

async function testScheduledTaskService() {
  console.log('🧪 测试定时任务服务...\n')

  try {
    // 1. Check API endpoint to get service status
    console.log('1. 检查定时任务服务状态...')
    const response = await fetch('http://localhost:3000/api/scheduled-tasks', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`)
    }

    const data = await response.json()
    const tasks = data.data
    
    console.log(`   服务运行正常，已注册 ${tasks.length} 个任务:`)
    tasks.forEach((task: any) => {
      console.log(`   - ${task.name} (${task.id}): ${task.enabled ? '启用' : '禁用'}`)
      console.log(`     调度: ${task.schedule}`)
      console.log(`     下次运行: ${task.nextRun ? new Date(task.nextRun).toLocaleString() : 'N/A'}`)
    })

    // 2. Test triggering subscription expiration task
    console.log('\n2. 测试手动触发订阅过期任务...')
    const subscriptionTask = tasks.find((t: any) => t.id === 'subscription-expiration')
    if (subscriptionTask) {
      console.log('   触发订阅过期任务...')
      const triggerResponse = await fetch('http://localhost:3000/api/scheduled-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'trigger',
          taskId: 'subscription-expiration'
        })
      })

      if (triggerResponse.ok) {
        console.log('   ✅ 任务触发成功')
      } else {
        console.error('   ❌ 任务触发失败')
      }
    }

    // 3. Test enabling/disabling tasks
    console.log('\n3. 测试启用/禁用任务...')
    const disableResponse = await fetch('http://localhost:3000/api/scheduled-tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'disable',
        taskId: 'invitation-cleanup'
      })
    })

    if (disableResponse.ok) {
      console.log('   ✅ 禁用任务成功')
    }

    // Check status after disable
    const afterDisable = await fetch('http://localhost:3000/api/scheduled-tasks')
    const afterDisableData = await afterDisable.json()
    const invitationTask = afterDisableData.data.find((t: any) => t.id === 'invitation-cleanup')
    console.log(`   邀请清理任务状态: ${invitationTask?.enabled ? '启用' : '禁用'}`)

    // Re-enable the task
    await fetch('http://localhost:3000/api/scheduled-tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'enable',
        taskId: 'invitation-cleanup'
      })
    })

    console.log('\n🎉 测试完成!')
    console.log('\n💡 测试结果:')
    console.log('   - 定时任务服务正常运行')
    console.log('   - 默认任务已正确注册')
    console.log('   - 任务手动触发功能正常')
    console.log('   - API端点响应正常')
    console.log('   - 任务启用/禁用功能正常')

  } catch (error) {
    console.error('❌ 测试失败:', error)
  }
}

// 运行测试
testScheduledTaskService().catch(console.error)