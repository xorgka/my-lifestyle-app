"use client";

import { HomeMemoCard } from "@/components/home/HomeMemoCard";
import { RoutineCard, SleepCard, TimetableCard } from "@/components/home/HomeWidgetCards";
import { InsightPhotoCard } from "@/components/home/InsightPhotoCard";
import { WeatherCardWrapper } from "@/components/home/WeatherCardWrapper";
import { useHomeWidgetData } from "@/components/home/useHomeWidgetData";

export type HomeTemplate = "A" | "B";

/** A = 현재 디자인. 위 날씨/메모/인사이트, 아래 일기|루틴|타임테이블. B = 동일 레이아웃 + 타임테이블 카드만 B 디자인(흰 박스+작은 시간 정사각형). */
export function HomeLayout({ template }: { template: HomeTemplate }) {
  const data = useHomeWidgetData();
  const timetableVariant = template === "B" ? "B" : "A";

  return (
    <>
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
      <div className="flex min-w-0 flex-wrap items-start gap-4">
        <SleepCard
          bedTime={data.todaySleepBedTime}
          wakeTime={data.todaySleepWakeTime}
          className="min-w-0 flex-1"
        />
        <RoutineCard
          routineProgress={data.routineProgress}
          routineCompleted={data.routineCompleted}
          routineTotal={data.routineTotal}
          className="w-[160px] shrink-0"
        />
        <div className="flex min-w-0 flex-[2] basis-full md:basis-0">
          <TimetableCard
            dayTimetable={data.dayTimetable}
            currentSlot={data.currentSlot}
            currentSlotDisplayHour={data.currentSlotDisplayHour}
            completedIds={data.completedIds}
            nextSlotHour={data.nextSlotHour}
            remainingText={data.remainingText}
            onToggle={data.handleTimetableToggle}
            variant={timetableVariant}
          />
        </div>
      </div>
    </>
  );
}
