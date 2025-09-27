import { redirect } from 'next/navigation';

export default function WorkflowsPage() {
  // Workflow 服务与路由已下线，统一由事件驱动与投影实现。
  // 将旧入口重定向到 Operations 聚合页。
  redirect('/operations');
}
