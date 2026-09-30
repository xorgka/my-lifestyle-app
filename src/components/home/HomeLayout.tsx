"use client";

import { HomeCalendarCard } from "@/components/home/HomeCalendarCard";
import { HomeDietCard } from "@/components/home/HomeDietCard";
import { HomeMemoCard } from "@/components/home/HomeMemoCard";
import { HomeVideoCard } from "@/components/home/HomeVideoCard";
import { RoutineCard, SleepCard, TimetableCard, TodayTimelineAxisPanel, TodayTimelinePanel } from "@/components/home/HomeWidgetCards";
import { InsightPhotoCard } from "@/components/home/InsightPhotoCard";
import { WeatherCardWrapper } from "@/components/home/WeatherCardWrapper";
import { useHomeWidgetData } from "@/components/home/useHomeWidgetData";

export type HomeTemplate = "A" | "B" | "video" | "calendar" | "timeline";

/** A = 현재 디자인. 위 날씨/메모/인사이트, 아래 일기|루틴|타임테이블. B = 동일 레이아웃 + 타임테이블 카드만 B 디자인(흰 박스+작은 시간 정사각형). video = 인사이트·타임테이블 대신 세로 영상 플레이어. */
export function HomeLayout({ template }: { template: HomeTemplate }) {
  const data = useHomeWidgetData();
  const timetableVariant = template === "B" ? "B" : "A";

  if (template === "calendar" || template === "timeline") {
    return (
      <>
        {/* 모바일: 오늘 타임라인 → 날씨 | 다이어트 → 달력 → 메모. 데스크톱: 맨 위 = 오늘 타임라인, 가운데 = 날씨(정사각형) | 메모 | 다이어트, 아래 = 달력.
            영상은 인사말 오른쪽 동그라미(HomeCornerVideo). 메모 폭 = 예전(날씨 1 : 메모 0.8, 영상 210px) 메모 폭의 약 88% */}
        <div className="grid grid-cols-[minmax(0,1fr)_124px] gap-4 md:grid-cols-[280px_calc((100%_-_2rem_-_210px)*0.39)_minmax(0,1fr)] md:items-stretch">
          <div className="order-2 flex h-[220px] min-w-0 flex-col md:col-start-1 md:row-start-2 md:h-[280px]">
            <WeatherCardWrapper compact />
          </div>
          <HomeDietCard className="order-3 h-[220px] w-full md:order-none md:col-start-3 md:row-start-2 md:h-[280px]" />
          {template === "timeline" ? (
            <TodayTimelineAxisPanel
              timelineSlots={data.timelineSlots}
              currentSlotId={data.currentSlot?.id ?? null}
              completedIds={data.completedIds}
              remainingText={data.remainingText}
              onToggle={data.handleTimetableToggle}
              className="order-1 col-span-2 md:order-none md:col-span-3 md:row-start-1"
            />
          ) : (
            <TodayTimelinePanel
              timelineSlots={data.timelineSlots}
              currentSlotId={data.currentSlot?.id ?? null}
              completedIds={data.completedIds}
              remainingText={data.remainingText}
              onToggle={data.handleTimetableToggle}
              className="order-1 col-span-2 md:order-none md:col-span-3 md:row-start-1"
            />
          )}
          <HomeCalendarCard className="order-4 col-span-2 md:order-none md:col-span-3 md:row-start-3 md:h-[520px]" />
          <div className="order-5 col-span-2 flex min-w-0 flex-col md:order-none md:col-span-1 md:col-start-2 md:row-start-2">
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
