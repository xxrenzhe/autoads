"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

const plans = [
  {
    name: "Free",
    price: "¥0",
    period: "永久",
    tokens: "1,000 Tokens",
    features: [
      "批量访问 (初级+静默)",
      "网站排名 (100次/任务)",
      "1个Google账户",
    ],
    cta: "开始使用",
    isCurrent: true,
  },
  {
    name: "Pro",
    price: "¥299",
    period: "/月",
    tokens: "10,000 Tokens",
    features: [
      "批量访问 (+自动化)",
      "网站排名 (500次/任务)",
      "10个Google账户",
      "AI机会评估",
      "A/B测试",
      "工作流模板",
    ],
    cta: "联系客服升级",
  },
  {
    name: "Max",
    price: "¥999",
    period: "/月",
    tokens: "100,000 Tokens",
    features: [
      "网站排名 (5000次/任务)",
      "100个Google账户",
      "转化率仿真模式",
      "AI合规预警",
      "AI风险机会通知",
    ],
    cta: "联系客服升级",
  },
];

type PricingPlansProps = {
  onSelectPlan: (plan: "Pro" | "Max") => void;
};

export function PricingPlans({ onSelectPlan }: PricingPlansProps) {
  const router = useRouter();
  
  const handleCtaClick = (planName: string) => {
    if (planName === 'Free') {
      router.push('/dashboard');
    } else {
      onSelectPlan(planName as "Pro" | "Max");
    }
  };

  return (
    <section className="py-12 bg-gray-50 sm:py-16 lg:py-20">
      <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 text-center sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.name} className={`flex flex-col ${plan.name === 'Pro' ? 'border-blue-500 shadow-lg' : ''}`}>
              <CardHeader>
                <CardTitle className="text-2xl font-semibold">{plan.name}</CardTitle>
                <CardDescription className="mt-4 text-5xl font-bold">
                  {plan.price}
                  <span className="text-xl font-normal text-gray-500">{plan.period}</span>
                </CardDescription>
                <p className="mt-2 text-sm text-gray-500">{plan.tokens}</p>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-4 text-left">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <CheckCircle className="w-5 h-5 mr-3 text-blue-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full"
                  variant={plan.name === 'Pro' ? 'default' : 'outline'}
                  onClick={() => handleCtaClick(plan.name)}
                >
                  {plan.cta}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
