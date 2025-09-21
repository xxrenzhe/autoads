import { PageFooter } from "@/components/PageFooter";
import { WeChatSubscribeModal } from "@/components/common/WeChatSubscribeModal";
import { PricingPage } from "@/components/pricing/PricingPage";
import { MainNavigation } from "@/components/navigation/MainNavigation";

export default function Page() {
  return (
    <div className="flex flex-col min-h-screen">
      <MainNavigation />
      <main className="flex-grow">
        <PricingPage />
      </main>
      <WeChatSubscribeModal />
      <PageFooter />
    </div>
  );
}
