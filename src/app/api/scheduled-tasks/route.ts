import { NextRequest, NextResponse } from 'next/server'
import { taskService } from '@/lib/scheduled-task-init'

/**
 * GET /api/scheduled-tasks
 * Get all scheduled tasks status
 */
export async function GET() {
  try {
    const tasks = taskService.getAllTasksStatus()
    
    return NextResponse.json({
      success: true,
      data: tasks.map(task => ({
        id: task.id,
        name: task.name,
        schedule: task.schedule,
        enabled: task.enabled,
        lastRun: task.lastRun,
        nextRun: task.nextRun,
        timezone: task.timezone
      }))
    })
  } catch (error) {
    console.error('Error getting scheduled tasks:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get scheduled tasks' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/scheduled-tasks
 * Control scheduled tasks (start/stop/enable/disable/trigger)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, taskId } = body

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'start':
        taskService.start()
        return NextResponse.json({ success: true, message: 'Scheduled task service started' })

      case 'stop':
        taskService.stop()
        return NextResponse.json({ success: true, message: 'Scheduled task service stopped' })

      case 'enable':
        if (!taskId) {
          return NextResponse.json(
            { success: false, error: 'Task ID is required for enable action' },
            { status: 400 }
          )
        }
        taskService.enableTask(taskId)
        return NextResponse.json({ success: true, message: `Task ${taskId} enabled` })

      case 'disable':
        if (!taskId) {
          return NextResponse.json(
            { success: false, error: 'Task ID is required for disable action' },
            { status: 400 }
          )
        }
        taskService.disableTask(taskId)
        return NextResponse.json({ success: true, message: `Task ${taskId} disabled` })

      case 'trigger':
        if (!taskId) {
          return NextResponse.json(
            { success: false, error: 'Task ID is required for trigger action' },
            { status: 400 }
          )
        }
        await taskService.triggerTask(taskId)
        return NextResponse.json({ success: true, message: `Task ${taskId} triggered` })

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error controlling scheduled tasks:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to control scheduled tasks' },
      { status: 500 }
    )
  }
}