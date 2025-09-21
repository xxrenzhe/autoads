import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check } from "lucide-react";

const features = [
  { feature: "批量访问 (初级+静默)", free: true, pro: true, max: true },
  { feature: "网站排名", free: "100次/任务", pro: "500次/任务", max: "5000次/任务" },
  { feature: "Google账户连接数", free: 1, pro: 10, max: 100 },
  { feature: "批量访问 (+自动化)", free: false, pro: true, max: true },
  { feature: "AI机会评估", free: false, pro: true, max: true },
  { feature: "A/B测试", free: false, pro: true, max: true },
  { feature: "工作流模板", free: false, pro: true, max: true },
  { feature: "转化率仿真模式", free: false, pro: false, max: true },
  { feature: "AI合规预警", free: false, pro: false, max: true },
  { feature: "AI风险机会通知", free: false, pro: false, max: true },
];

export function PricingComparison() {
  const renderValue = (value: string | number | boolean) => {
    if (typeof value === 'boolean') {
      return value ? <Check className="text-blue-500" /> : <span className="text-gray-400">-</span>;
    }
    return value;
  };

  return (
    <section className="py-12 bg-white sm:py-16 lg:py-20">
      <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">功能对比</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">功能</TableHead>
                  <TableHead className="text-center">Free</TableHead>
                  <TableHead className="text-center">Pro</TableHead>
                  <TableHead className="text-center">Max</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {features.map((item) => (
                  <TableRow key={item.feature}>
                    <TableCell className="font-medium">{item.feature}</TableCell>
                    <TableCell className="text-center">{renderValue(item.free)}</TableCell>
                    <TableCell className="text-center">{renderValue(item.pro)}</TableCell>
                    <TableCell className="text-center">{renderValue(item.max)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
