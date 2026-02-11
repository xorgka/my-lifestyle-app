"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadJournalEntries } from "@/lib/journal";
import { loadRoutineItems, loadRoutineCompletions } from "@/lib/routineDb";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function HomeWidgets() {
  const [journalWritten, setJournalWritten] = useState<boolean | null>(null);
  const [routineProgress, setRoutineProgress] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
  );

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
    const tick = () =>
      setCurrentTime(
        new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const baseWidget =
    "widget-grain-texture relative flex min-h-[160px] w-full flex-col rounded-2xl px-7 py-5 shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)]";
  const iconPosition = "absolute right-4 top-4 left-auto z-10 text-[1.75rem] text-white/80";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* 일기 - 네이비 */}
      <Link
        href="/journal"
        className={`${baseWidget} bg-gradient-to-br from-[#1e3a8a] via-[#1e293b] to-[#0f172a]`}
      >
        <span className={iconPosition}>
          <i className="fa-solid fa-pen-to-square" aria-hidden />
        </span>
        <div className="flex flex-1 flex-col justify-center pt-1">
          <span className="text-sm font-medium text-white/90">오늘 일기</span>
          <span className="mt-1 text-3xl font-bold text-white">
            {journalWritten === null ? "—" : journalWritten ? "작성함" : "미작성"}
          </span>
        </div>
      </Link>

      {/* 루틴 - #F94154 계열 */}
      <Link
        href="/routine"
        className={`${baseWidget} bg-gradient-to-br from-[#F94154] via-[#e63946] to-[#c1121f]`}
      >
        <span className={iconPosition}>
          <i className="fa-solid fa-circle-check" aria-hidden />
        </span>
        <div className="flex flex-1 flex-col justify-center pt-1">
          <span className="text-sm font-medium text-white/90">오늘 루틴 진행률</span>
          <span className="mt-1 text-3xl font-bold text-white">
            {routineProgress === null ? "—" : `${routineProgress}%`}
          </span>
        </div>
      </Link>

      {/* 타임테이블 - 오렌지 (쨍하게) */}
      <Link
        href="/routine/timetable"
        className={`${baseWidget} bg-gradient-to-br from-[#fb923c] via-[#f97316] to-[#ea580c]`}
      >
        <span className={iconPosition}>
          <i className="fa-solid fa-table-cells" aria-hidden />
        </span>
        <div className="flex flex-1 flex-col justify-center pt-1">
          <span className="text-sm font-medium text-white/90">타임테이블</span>
          <span className="mt-1 text-3xl font-bold text-white tabular-nums">{currentTime}</span>
        </div>
      </Link>
    </div>
  );
}
