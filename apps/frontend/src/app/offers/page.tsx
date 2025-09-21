// apps/frontend/src/app/offers/page.tsx
import { PageFooter } from "@/components/PageFooter";
import { MainNavigation } from "@/components/navigation/MainNavigation";
import { OfferBoard } from "./components/OfferBoard";

export default function Page() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <MainNavigation />
      <main className="flex-grow">
        <OfferBoard />
      </main>
      <PageFooter />
    </div>
  );
}
