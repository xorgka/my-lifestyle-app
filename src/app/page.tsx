import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { HomeWidgets } from "@/components/home/HomeWidgets";
import { TodayAlertBar } from "@/components/home/TodayAlertBar";
import { TodayInsightHero } from "@/components/home/TodayInsightHero";
import { WeatherCard } from "@/components/home/WeatherCard";

export default function HomePage() {
  return (
    <div className="min-w-0 space-y-6 md:space-y-8">
      <SectionTitle
        title="오늘을 정리하기"
        subtitle="날씨, 인사이트, 루틴, 가계부까지 한 화면에서 부드럽게 관리해요."
      />

      <div className="flex flex-col gap-4">
        <TodayAlertBar />
        <WeatherCard />
      </div>

      {/* 오늘의 인사이트 카드 - 따뜻한 톤 + 은은한 텍스처 */}
      <Card className="insight-texture relative flex min-w-0 flex-col justify-between rounded-3xl bg-gradient-to-br from-amber-50/70 via-[#faf8f5] to-stone-100/90 px-4 py-6 sm:px-6 sm:py-7 md:px-8 md:py-8">
        <div className="relative min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            TODAY&apos;S INSIGHT
          </div>
          <TodayInsightHero />
        </div>
      </Card>

      {/* 아이폰 위젯 스타일: 일기 / 루틴 / 수입 */}
      <HomeWidgets />
    </div>
  );
}

