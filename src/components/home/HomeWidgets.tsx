"use client";

import { DiaryCard, RoutineCard, TimetableCard } from "@/components/home/HomeWidgetCards";
import { useHomeWidgetData } from "@/components/home/useHomeWidgetData";

/** 템플릿 A용 하단 3칸: 일기 / 루틴 / 타임테이블. 순서 변경 시 HomeLayout에서 처리. */
export function HomeWidgets() {
  const data = useHomeWidgetData();

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <DiaryCard journalWritten={data.journalWritten} />
      <RoutineCard
        routineProgress={data.routineProgress}
        routineCompleted={data.routineCompleted}
        routineTotal={data.routineTotal}
      />
      <TimetableCard
        dayTimetable={data.dayTimetable}
        currentSlot={data.currentSlot}
        currentSlotDisplayHour={data.currentSlotDisplayHour}
        completedIds={data.completedIds}
        nextSlotHour={data.nextSlotHour}
        remainingText={data.remainingText}
        onToggle={data.handleTimetableToggle}
      />
    </div>
  );
}
