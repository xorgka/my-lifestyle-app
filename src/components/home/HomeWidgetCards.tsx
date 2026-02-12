"use client";

import Link from "next/link";
import type { DayTimetable, TimetableSlot } from "@/lib/timetableDb";

const baseWidget =
  "widget-grain-texture relative flex min-h-[160px] w-full flex-col rounded-2xl px-7 py-5 shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)]";
const iconPosition = "absolute right-4 top-4 left-auto z-10 text-[1.75rem] text-white/80";

export function DiaryCard({
  journalWritten,
  className = "col-span-1",
}: {
  journalWritten: boolean | null;
  className?: string;
}) {
  return (
    <Link
      href="/journal"
      className={`${className} ${baseWidget} border border-[#1842E2]/30 bg-[#1842E2]`}
    >
      <span className={`${iconPosition} text-white/90`}>
        <i className="fa-solid fa-pen-to-square" aria-hidden />
      </span>
      <div className="flex flex-1 flex-col justify-center pt-1">
        <span className="text-sm font-medium text-white/90">오늘 일기</span>
        <span className="mt-1 text-3xl font-bold text-white">
          {journalWritten === null ? "—" : journalWritten ? "작성함" : "미작성"}
        </span>
      </div>
    </Link>
  );
}

export function RoutineCard({
  routineProgress,
  className = "col-span-1",
}: {
  routineProgress: number | null;
  className?: string;
}) {
  return (
    <Link
      href="/routine"
      className={`${className} ${baseWidget} border border-[#ED7053]/40 bg-[#ED7053]`}
    >
      <span className={`${iconPosition} text-white/90`}>
        <i className="fa-solid fa-circle-check" aria-hidden />
      </span>
      <div className="flex flex-1 flex-col justify-center pt-1">
        <span className="text-sm font-medium text-white/90">오늘 루틴</span>
        <span className="mt-1 text-3xl font-bold text-white">
          {routineProgress === null ? "—" : `${routineProgress}%`}
        </span>
      </div>
    </Link>
  );
}

type TimetableCardProps = {
  dayTimetable: DayTimetable | null;
  currentSlot: TimetableSlot | null;
  completedIds: string[];
  nextSlotHour: number;
  remainingText: string | null;
  onToggle: (itemId: string) => void;
  className?: string;
};

export function TimetableCard({
  dayTimetable,
  currentSlot,
  completedIds,
  nextSlotHour,
  remainingText,
  onToggle,
  className = "col-span-2",
}: TimetableCardProps) {
  return (
    <Link
      href="/routine/timetable"
      className={`widget-grain-texture relative ${className} flex min-h-[160px] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-[#f97316] shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)]`}
    >
      <span className={iconPosition}>
        <i className="fa-solid fa-table-cells" aria-hidden />
      </span>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {currentSlot ? (
          <div className="flex min-h-0 min-w-0 flex-1 bg-white/95">
            <div className="flex w-28 shrink-0 flex-col items-center justify-center gap-1 border-r border-[#F19E36]/40 bg-[#F19E36] py-3 md:w-32">
              <span className="text-2xl font-bold text-white md:text-3xl">
                {Number(currentSlot.time)}시
              </span>
              {remainingText != null && (
                <span
                  className="text-sm font-medium tabular-nums text-white md:text-base"
                  title={`다음 ${nextSlotHour >= 24 ? "자정" : `${nextSlotHour}시`}까지`}
                >
                  {remainingText}
                </span>
              )}
            </div>
            <ul className="min-w-0 flex-1 overflow-auto bg-white py-1 pr-2">
              {currentSlot.items.length === 0 ? (
                <li className="border-b border-neutral-200 px-3 py-2 text-base text-neutral-500">
                  항목 없음
                </li>
              ) : (
                currentSlot.items.map((item) => {
                  const isCompleted = completedIds.includes(item.id);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2.5 last:border-b-0"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span
                          className={`flex shrink-0 ${isCompleted ? "text-neutral-300" : "text-neutral-400"}`}
                          aria-hidden
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </span>
                        <span
                          className={`min-w-0 truncate text-base font-semibold md:text-lg ${isCompleted ? "text-neutral-300 line-through" : "text-neutral-800"}`}
                        >
                          {item.text || "항목"}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onToggle(item.id);
                        }}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition ${
                          isCompleted
                            ? "border-neutral-700 bg-neutral-700 text-white"
                            : "border-neutral-300 bg-transparent hover:border-neutral-400"
                        }`}
                        aria-label={isCompleted ? "완료 해제" : "완료"}
                      >
                        {isCompleted && (
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-center px-5 py-4">
            <span className="text-sm font-medium text-white/90">타임테이블</span>
            <span className="mt-1 text-2xl font-bold text-white">오늘 시간대</span>
          </div>
        )}
      </div>
    </Link>
  );
}
