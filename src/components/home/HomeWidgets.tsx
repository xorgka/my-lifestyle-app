"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadJournalEntries } from "@/lib/journal";
import { loadRoutineItems, loadRoutineCompletions, toggleRoutineCompletion } from "@/lib/routineDb";
import { loadTimetableForDate, saveTimetableForDate, getTodayKey, type DayTimetable, type TimetableSlot } from "@/lib/timetableDb";
import { loadTimetableRoutineLinks, getRoutineIdByTimetableId } from "@/lib/timetableRoutineLinks";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 현재 시각이 속한 슬롯 찾기. 슬롯 시간은 해당 시각~다음 슬롯 전까지 (예: 12시 슬롯 = 12~15시) */
function getCurrentSlot(day: DayTimetable | null): TimetableSlot | null {
  if (!day || day.slots.length === 0) return null;
  const sorted = [...day.slots].sort((a, b) => Number(a.time) - Number(b.time));
  const currentHour = new Date().getHours();
  for (let i = 0; i < sorted.length; i++) {
    const slotTime = Number(sorted[i].time);
    const nextTime = i + 1 < sorted.length ? Number(sorted[i + 1].time) : 24;
    if (currentHour >= slotTime && currentHour < nextTime) return sorted[i];
  }
  return sorted[0];
}

/** 현재 슬롯의 다음 시간대(시). 마지막 슬롯이면 24 */
function getNextSlotHour(day: DayTimetable | null, currentSlot: TimetableSlot | null): number {
  if (!day || !currentSlot || day.slots.length === 0) return 24;
  const sorted = [...day.slots].sort((a, b) => Number(a.time) - Number(b.time));
  const idx = sorted.findIndex((s) => s.id === currentSlot.id);
  if (idx < 0 || idx + 1 >= sorted.length) return 24;
  return Number(sorted[idx + 1].time);
}

/** 다음 시간대까지 남은 시간 문자열 (HH:MM:SS) */
function getRemainingToNextSlot(nextHour: number, now: Date): string {
  const end = new Date(now);
  if (nextHour >= 24) {
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);
  } else {
    end.setHours(nextHour, 0, 0, 0);
  }
  let ms = end.getTime() - now.getTime();
  if (ms <= 0) return "0:00:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function HomeWidgets() {
  const [journalWritten, setJournalWritten] = useState<boolean | null>(null);
  const [routineProgress, setRoutineProgress] = useState<number | null>(null);
  const [dayTimetable, setDayTimetable] = useState<DayTimetable | null>(null);
  const [routineLinks, setRoutineLinks] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    loadJournalEntries().then((entries) => {
      if (cancelled) return;
      const today = todayStr();
      setJournalWritten(entries.some((e) => e.date === today && e.content.trim().length > 0));
    }).catch(() => {
      if (!cancelled) setJournalWritten(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadRoutineItems(), loadRoutineCompletions()]).then(([items, daily]) => {
      if (cancelled) return;
      const todayKey = getTodayKey();
      const completed = daily[todayKey] ?? [];
      const total = items.length;
      const pct = total === 0 ? 0 : Math.round((completed.length / total) * 100);
      setRoutineProgress(pct);
    }).catch(() => {
      if (!cancelled) setRoutineProgress(0);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadTimetableForDate(getTodayKey()).then((day) => {
      if (!cancelled) setDayTimetable(day);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    loadTimetableRoutineLinks().then(setRoutineLinks);
  }, []);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const currentSlot = getCurrentSlot(dayTimetable);
  const completedIds = dayTimetable?.completedIds ?? [];
  const nextSlotHour = getNextSlotHour(dayTimetable, currentSlot);
  const remainingText = currentSlot ? getRemainingToNextSlot(nextSlotHour, now) : null;

  const handleTimetableToggle = async (itemId: string) => {
    if (!dayTimetable) return;
    const completed = new Set(dayTimetable.completedIds);
    const isCompleted = completed.has(itemId);
    if (isCompleted) completed.delete(itemId);
    else completed.add(itemId);
    const completedIds = Array.from(completed);
    const next = { ...dayTimetable, completedIds };
    setDayTimetable(next);
    await saveTimetableForDate(getTodayKey(), next);
    const routineId = getRoutineIdByTimetableId(routineLinks, itemId);
    if (routineId != null) {
      toggleRoutineCompletion(getTodayKey(), routineId, !isCompleted).catch(() => {});
    }
  };

  const baseWidget =
    "widget-grain-texture relative flex min-h-[160px] w-full flex-col rounded-2xl px-7 py-5 shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)]";
  const iconPosition = "absolute right-4 top-4 left-auto z-10 text-[1.75rem] text-white/80";

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {/* 일기 - 25%, #1842E2 블루 계열 */}
      <Link
        href="/journal"
        className={`col-span-1 ${baseWidget} border border-[#1842E2]/30 bg-[#1842E2]`}
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

      {/* 루틴 - 25%, #ED7053 코랄 계열 */}
      <Link
        href="/routine"
        className={`col-span-1 ${baseWidget} border border-[#ED7053]/40 bg-[#ED7053]`}
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

      {/* 타임테이블 - 50%, 현재 시간대 슬롯 미리보기 */}
      <Link
        href="/routine/timetable"
        className="widget-grain-texture relative col-span-2 flex min-h-[160px] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-[#f97316] shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
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
                  <span className="text-sm font-medium tabular-nums text-white md:text-base" title={`다음 ${nextSlotHour >= 24 ? "자정" : `${nextSlotHour}시`}까지`}>
                    {remainingText}
                  </span>
                )}
              </div>
              <ul className="min-w-0 flex-1 overflow-auto bg-white py-1 pr-2">
                {currentSlot.items.length === 0 ? (
                  <li className="border-b border-neutral-200 px-3 py-2 text-base text-neutral-500">항목 없음</li>
                ) : (
                  currentSlot.items.map((item) => {
                    const isCompleted = completedIds.includes(item.id);
                    return (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2.5 last:border-b-0"
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          <span className={`flex shrink-0 ${isCompleted ? "text-neutral-300" : "text-neutral-400"}`} aria-hidden>
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </span>
                          <span className={`min-w-0 truncate text-base font-semibold md:text-lg ${isCompleted ? "text-neutral-300 line-through" : "text-neutral-800"}`}>
                            {item.text || "항목"}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleTimetableToggle(item.id);
                          }}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition ${
                            isCompleted
                              ? "border-neutral-700 bg-neutral-700 text-white"
                              : "border-neutral-300 bg-transparent hover:border-neutral-400"
                          }`}
                          aria-label={isCompleted ? "완료 해제" : "완료"}
                        >
                          {isCompleted && (
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
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
    </div>
  );
}
