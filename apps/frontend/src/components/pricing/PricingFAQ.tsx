import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const faqs = [
  {
    question: "我可以随时升级或降级我的套餐吗？",
    answer: "是的，您可以随时联系我们的客服进行套餐变更。新的计费周期将从变更确认日开始。",
  },
  {
    question: "Token用完后会怎么样？",
    answer: "如果您的Token用完，需要消耗Token的功能将暂时无法使用。您可以联系客服单独购买Token包，或者升级到更高级别的套餐。",
  },
  {
    question: "你们接受哪些支付方式？",
    answer: "目前我们主要通过微信或支付宝进行线下收款。在您联系客服后，我们会提供详细的支付指引。",
  },
  {
    question: "免费版和付费版在功能上有什么核心区别？",
    answer: "免费版旨在让您体验产品的核心功能。付费版（Pro和Max）则解锁了自动化、AI智能分析和更高级别的处理能力，旨在帮助专业用户和团队实现规模化增长。",
  },
];

export function PricingFAQ() {
  return (
    <section className="py-12 bg-gray-50 sm:py-16 lg:py-20">
      <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">常见问题</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger>{faq.question}</AccordionTrigger>
                  <AccordionContent>{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
