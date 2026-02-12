"use client";

import { HomeMemoCard } from "@/components/home/HomeMemoCard";
import { DiaryCard, RoutineCard, TimetableCard } from "@/components/home/HomeWidgetCards";
import { InsightPhotoCard } from "@/components/home/InsightPhotoCard";
import { WeatherCardWrapper } from "@/components/home/WeatherCardWrapper";
import { useHomeWidgetData } from "@/components/home/useHomeWidgetData";

export type HomeTemplate = "A" | "B";

/** A = 메모↔일기. 위 1줄 날씨|인사이트, 2줄 일기|루틴(일기 옆 루틴). 아래 메모|타임테이블. B = 원래 배치 */
export function HomeLayout({ template }: { template: HomeTemplate }) {
  const data = useHomeWidgetData();

  const slotFill = "flex min-h-0 min-w-0 flex-1 flex-col";
  const isSwapped = template === "A";
  const topCardClass = "min-h-[160px] w-full flex-1";

  return (
    <>
      {isSwapped ? (
        <>
          {/* A: 2열. 왼쪽 날씨+일기|루틴+메모 / 오른쪽 인사이트+타임테이블. 모바일도 1줄에 날씨|인사이트 */}
          <div className="grid min-h-0 min-w-0 grid-cols-2 gap-4 md:gap-6">
            <div className="flex min-h-0 min-w-0 flex-col gap-4">
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
                <WeatherCardWrapper />
              </div>
              <div className="grid min-h-0 min-w-0 grid-cols-2 gap-4">
                <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
                  <DiaryCard journalWritten={data.journalWritten} className={topCardClass} />
                </div>
                <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
                  <RoutineCard routineProgress={data.routineProgress} className={topCardClass} />
                </div>
              </div>
              <div className="flex min-h-0 min-w-0 flex-col">
                <HomeMemoCard />
              </div>
            </div>
            <div className="flex min-h-0 min-w-[180px] flex-col gap-4 sm:min-w-0">
              <div className="flex min-h-0 max-h-[280px] min-w-0 flex-1 flex-col overflow-hidden">
                <TimetableCard
                  dayTimetable={data.dayTimetable}
                  currentSlot={data.currentSlot}
                  completedIds={data.completedIds}
                  nextSlotHour={data.nextSlotHour}
                  remainingText={data.remainingText}
                  onToggle={data.handleTimetableToggle}
                  className="h-full min-h-0 w-full"
                />
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <InsightPhotoCard />
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* B: 위 날씨+메모|인사이트, 아래 일기|루틴|타임테이블 */}
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DiaryCard journalWritten={data.journalWritten} />
            <RoutineCard routineProgress={data.routineProgress} />
            <TimetableCard
              dayTimetable={data.dayTimetable}
              currentSlot={data.currentSlot}
              completedIds={data.completedIds}
              nextSlotHour={data.nextSlotHour}
              remainingText={data.remainingText}
              onToggle={data.handleTimetableToggle}
            />
          </div>
        </>
      )}
    </>
  );
}
