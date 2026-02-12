import { SectionTitle } from "@/components/ui/SectionTitle";
import { HomeMemoCard } from "@/components/home/HomeMemoCard";
import { HomeWidgets } from "@/components/home/HomeWidgets";
import { InsightPhotoCard } from "@/components/home/InsightPhotoCard";
import { TodayAlertBar } from "@/components/home/TodayAlertBar";
import { WeatherCardWrapper } from "@/components/home/WeatherCardWrapper";

export default function HomePage() {
  return (
    <div className="min-w-0 space-y-4 sm:space-y-6 md:space-y-8">
      <SectionTitle
        title="오늘을 정리하기"
        subtitle="날씨, 인사이트, 루틴, 가계부까지 한 화면에서 부드럽게 관리해요."
      />

      <div className="flex flex-col gap-4">
        <TodayAlertBar />
        {/* 모바일: 날씨 / 메모 / 인사이트 */}
        <div className="grid min-h-[600px] grid-cols-1 grid-rows-[160px_1fr_1fr] gap-4 md:hidden">
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <WeatherCardWrapper />
          </div>
          <div className="flex min-h-0 min-w-0 flex-col">
            <HomeMemoCard />
          </div>
          <div className="flex min-h-0 min-w-0 flex-col">
            <InsightPhotoCard />
          </div>
        </div>
        {/* PC: 왼쪽 날씨+메모, 오른쪽 인사이트 */}
        <div className="hidden min-h-[480px] md:grid md:min-h-[600px] md:grid-cols-2 md:gap-6 md:items-stretch">
          <div className="flex min-h-0 min-w-0 flex-col gap-4">
            <div className="flex min-h-0 flex-1 flex-col">
              <WeatherCardWrapper />
            </div>
            <div className="flex flex-shrink-0 flex-col">
              <HomeMemoCard />
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 flex-col">
            <InsightPhotoCard />
          </div>
        </div>
      </div>

      {/* 일기 / 루틴 / 타임테이블 */}
      <HomeWidgets />
    </div>
  );
}
