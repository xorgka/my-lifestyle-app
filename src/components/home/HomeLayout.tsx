"use client";

import { HomeCalendarCard } from "@/components/home/HomeCalendarCard";
import { HomeMemoCard } from "@/components/home/HomeMemoCard";
import { HomeVideoCard } from "@/components/home/HomeVideoCard";
import { RoutineCard, SleepCard, TimetableCard } from "@/components/home/HomeWidgetCards";
import { InsightPhotoCard } from "@/components/home/InsightPhotoCard";
import { WeatherCardWrapper } from "@/components/home/WeatherCardWrapper";
import { useHomeWidgetData } from "@/components/home/useHomeWidgetData";

export type HomeTemplate = "A" | "B" | "video" | "calendar";

/** A = 현재 디자인. 위 날씨/메모/인사이트, 아래 일기|루틴|타임테이블. B = 동일 레이아웃 + 타임테이블 카드만 B 디자인(흰 박스+작은 시간 정사각형). video = 인사이트·타임테이블 대신 세로 영상 플레이어. */
export function HomeLayout({ template }: { template: HomeTemplate }) {
  const data = useHomeWidgetData();
  const timetableVariant = template === "B" ? "B" : "A";

  if (template === "calendar") {
    return (
      <>
        {/* 모바일: 날씨 | 영상 → 달력 → 메모. 데스크톱: 위 줄 = 날씨 | 메모 | 영상, 아래 줄 = 달력 */}
        <div className="grid grid-cols-[minmax(0,1fr)_124px] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_158px] md:items-stretch">
          <div className="order-1 flex h-[220px] min-w-0 flex-col md:col-start-1 md:row-start-1 md:h-[280px]">
            <WeatherCardWrapper compact />
          </div>
          <HomeVideoCard
            compact
            className="order-2 h-[220px] w-full md:order-none md:col-start-3 md:row-start-1 md:h-[280px]"
          />
          <HomeCalendarCard className="order-3 col-span-2 md:order-none md:col-span-3 md:row-start-2 md:h-[520px]" />
          <div className="order-4 col-span-2 flex min-w-0 flex-col md:order-none md:col-span-1 md:col-start-2 md:row-start-1">
            <HomeMemoCard />
          </div>
        </div>
      </>
    );
  }

  if (template === "video") {
    const sleepRoutineRow = (
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
      </div>
    );
    return (
      <>
        <div className="grid grid-cols-1 gap-4 md:hidden">
          <div className="flex min-h-[140px] min-w-0 flex-col overflow-hidden">
            <WeatherCardWrapper />
          </div>
          <div className="flex min-h-0 min-w-0 flex-col">
            <HomeMemoCard />
          </div>
          {sleepRoutineRow}
          <HomeVideoCard className="h-[560px]" />
        </div>
        <div className="hidden md:grid md:min-h-[820px] md:grid-cols-2 md:gap-6 md:items-stretch">
          <div className="flex min-h-0 min-w-0 flex-col gap-4">
            <div className="flex min-h-0 flex-1 flex-col">
              <WeatherCardWrapper />
            </div>
            <div className="flex flex-shrink-0 flex-col">
              <HomeMemoCard />
            </div>
            {sleepRoutineRow}
          </div>
          <div className="flex min-h-0 min-w-0 flex-col self-start">
            <HomeVideoCard className="h-[820px]" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="grid min-h-[500px] grid-cols-1 grid-rows-[minmax(140px,auto)_1fr_1fr] gap-4 md:hidden">
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
