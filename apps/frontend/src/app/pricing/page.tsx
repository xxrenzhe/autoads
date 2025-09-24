'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Check, Star, Zap } from 'lucide-react';
import CustomerServiceDialog from '@/components/pricing/CustomerServiceDialog';
import MainNavigation from '@/components/navigation/MainNavigation';
import PageFooter from '@/components/PageFooter';

const plans = [
  {
    name: 'Pro',
    price: '¥199',
    unit: '/月',
    description: '自动化提效',
    features: [
      '自动化 "批量访问"',
      '网站排名查询 (500次)',
      '10个Google账户集成',
      'AI机会评估',
      'A/B测试功能',
      '工作流模板',
      '包含 10,000 Tokens'
    ],
    cta: '立即订阅',
    icon: <Zap className="h-6 w-6" />,
    popular: true,
  },
  {
    name: 'Max',
    price: '¥999',
    unit: '/月',
    description: '智能化决策',
    features: [
      '转化率仿真模式',
      '网站排名查询 (5000次)',
      '100个Google账户集成',
      'AI合规预警',
      'AI风险机会通知',
      '所有Pro套餐功能',
      '包含 100,000 Tokens'
    ],
    cta: '立即订阅',
    icon: <Zap className="h-6 w-6" />
  }
];

const faqs = [
  {
    question: '是否提供免费版？',
    answer: '当前不提供免费版。您可通过联系客服获取演示与评估建议，并按 Pro/Max/Elite 订阅使用。'
  },
  {
    question: 'Tokens是什么？如何消耗？',
    answer: 'Tokens是平台内的消耗单位。您执行的大部分操作，如查询网站排名、模拟点击、使用AI功能等，都会消耗一定数量的Tokens。具体消耗规则请参考我们的文档。'
  },
  {
    question: '订阅后可以随时取消吗？',
    answer: '是的，您可以随时联系我们的客服取消您的订阅。您的套餐权益将持续到当前计费周期结束。'
  },
  {
    question: '我需要绑定信用卡吗？',
    answer: '在初期，我们采用客服一对一服务的方式来处理订阅和充值，您无需绑定信用卡。只需联系客服，他们会引导您完成所有操作。'
  }
];

export default function PricingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSubscribeClick = () => {
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50">
      <MainNavigation />
      <main className="flex-grow">
        <div className="container mx-auto px-4 py-12">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">一个价格，释放所有增长潜力</h1>
            <p className="mt-4 text-lg text-muted-foreground">选择最适合您业务规模的套餐，立即开始您的增长之旅。</p>
          </div>

          {/* Pricing Plans */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.name} className={`flex flex-col ${plan.popular ? 'border-primary border-2' : ''}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    {plan.icon}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                  <div>
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.unit && <span className="text-muted-foreground">{plan.unit}</span>}
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <ul className="space-y-4">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start">
                        <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-1" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" onClick={handleSubscribeClick} disabled={plan.name === 'Free'}>
                    {plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="mt-20">
            <h2 className="text-3xl font-bold text-center mb-8">常见问题</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {faqs.map((faq) => (
                <div key={faq.question}>
                  <h3 className="font-semibold">{faq.question}</h3>
                  <p className="text-muted-foreground mt-2">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <PageFooter />
      <CustomerServiceDialog open={isModalOpen} onOpenChange={setIsModalOpen} />
    </div>
  );
}
