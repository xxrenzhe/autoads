"use client";
import { useRouter } from "next/navigation";
import { PricingComparison } from "./PricingComparison";
import { PricingFAQ } from "./PricingFAQ";
import { PricingPlans } from "./PricingPlans";
import { GenericHeroSection } from "../common/GenericHeroSection";
import { usePathname } from 'next/navigation'

export function PricingPage() {
  const router = useRouter();
  const pathname = usePathname() || '';

  const handleSelectPlan = (plan: "Pro" | "Max") => {
    console.log(`Selected plan: ${plan}, navigating to subscribe modal trigger.`);
    // Store the current path to return to it after the modal is closed
    window.sessionStorage.setItem('currentPathForModal', pathname || '/');
    router.push("/wechat-subscribe");
  };

  return (
    <>
      <GenericHeroSection
        title="选择适合您的计划"
        subtitle="从免费试用到功能强大的高级版，我们为您的每一步提供支持。"
      />
      <PricingPlans onSelectPlan={handleSelectPlan} />
      <PricingComparison />
      <PricingFAQ />
    </>
  );
}
