import { HomeGreeting } from "@/components/home/HomeGreeting";
import { HomeTemplateLayout } from "@/components/home/HomeTemplateLayout";
import { TodayAlertBar } from "@/components/home/TodayAlertBar";

export default function HomePage() {
  return (
    // 아래 여백: 맨 아래 카드와 화면 끝 사이가 너무 붙지 않게
    <div className="min-w-0 space-y-4 pb-6 sm:space-y-6 md:space-y-8 md:pb-6">
      <div className="relative min-w-0">
        <HomeGreeting className="min-w-0" />
      </div>

      <div className="flex flex-col gap-4">
        <TodayAlertBar />
        <HomeTemplateLayout />
      </div>
    </div>
  );
}
