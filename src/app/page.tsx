import { SectionTitle } from "@/components/ui/SectionTitle";
import { HomeTemplateLayout } from "@/components/home/HomeTemplateLayout";
import { TodayAlertBar } from "@/components/home/TodayAlertBar";

export default function HomePage() {
  return (
    <div className="min-w-0 space-y-4 sm:space-y-6 md:space-y-8">
      <div className="relative min-w-0">
        <SectionTitle
          className="min-w-0"
          title="오늘을 정리하기"
          subtitle="일상의 모든 조각을 한 곳에."
        />
      </div>

      <div className="flex flex-col gap-4">
        <TodayAlertBar />
        <HomeTemplateLayout />
      </div>
    </div>
  );
}
