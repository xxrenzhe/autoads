import { redirect } from 'next/navigation'

export default function SiterankPage() {
  // 老路由已收敛到 Insights 聚合页
  redirect('/insights')
}
