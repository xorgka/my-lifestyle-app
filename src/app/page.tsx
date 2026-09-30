import { HomeGreeting } from "@/components/home/HomeGreeting";
import { HomeCornerVideo, HomeTemplateLayout } from "@/components/home/HomeTemplateLayout";
import { TodayAlertBar } from "@/components/home/TodayAlertBar";

export default function HomePage() {
  return (
    // 아래 여백: 맨 아래 카드와 화면 끝 사이가 너무 붙지 않게
    <div className="min-w-0 space-y-4 pb-6 sm:space-y-6 md:space-y-7 md:pb-6">
      <div className="relative flex min-w-0 items-start justify-between gap-3">
        {/* 인사말 아래 기본 여백(md:mb-10)이 타임라인까지 너무 멀어서 PC에서는 없애고 칸 사이 간격(md:space-y-7)만 둠 */}
        <HomeGreeting className="min-w-0 md:!mb-0" />
        <HomeCornerVideo />
      </div>

      <div className="flex flex-col gap-4">
        <TodayAlertBar />
        <HomeTemplateLayout />
      </div>
    </div>
  );
}
