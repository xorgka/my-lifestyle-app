import { SectionTitle } from "@/components/ui/SectionTitle";
import { HomeLayout } from "@/components/home/HomeLayout";
import { TodayAlertBar } from "@/components/home/TodayAlertBar";

export default function HomePage() {
  return (
    <div className="min-w-0 space-y-4 sm:space-y-6 md:space-y-8">
      <SectionTitle
        title="오늘을 정리하기"
        subtitle="날씨, 인사이트, 루틴, 가계부까지 한 화면에서 부드럽게 관리해요."
      />

      <div className="flex flex-col gap-4">
        <TodayAlertBar />
        <HomeLayout template="B" />
      </div>
    </div>
  );
}
