"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadIncomeEntries } from "@/lib/income";
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

function formatNum(n: number): string {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

/** 이번달 수입: 만 단위 반올림 표기 (예: 155만원) */
function formatMonthIncomeRounded(amount: number): string {
  const man = Math.round(amount / 10000);
  return `${man.toLocaleString("ko-KR")}만원`;
}

export function HomeWidgets() {
  const [journalWritten, setJournalWritten] = useState<boolean | null>(null);
  const [routineProgress, setRoutineProgress] = useState<number | null>(null);
  const [monthIncome, setMonthIncome] = useState<number | null>(null);
  const [showFullMonthIncome, setShowFullMonthIncome] = useState(false);

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
    loadIncomeEntries().then((entries) => {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const sum = entries
        .filter((e) => e.year === y && e.month === m)
        .reduce((s, e) => s + e.amount, 0);
      setMonthIncome(sum);
    });
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

      {/* 수입 - 오렌지 (쨍하게) */}
      <Link
        href="/income"
        className={`${baseWidget} bg-gradient-to-br from-[#fb923c] via-[#f97316] to-[#ea580c]`}
      >
        <span className={iconPosition}>
          <i className="fa-solid fa-wallet" aria-hidden />
        </span>
        <div className="flex flex-1 flex-col justify-center pt-1">
          <span className="text-sm font-medium text-white/90">이번달 수입</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowFullMonthIncome((v) => !v);
            }}
            className="mt-1 text-left text-3xl font-bold text-white underline-offset-2 hover:underline"
            title={monthIncome != null ? "클릭하면 원래 금액 표시" : undefined}
          >
            {monthIncome === null
              ? "—"
              : showFullMonthIncome
                ? `${formatNum(monthIncome)}원`
                : formatMonthIncomeRounded(monthIncome)}
          </button>
        </div>
      </Link>
    </div>
  );
}
