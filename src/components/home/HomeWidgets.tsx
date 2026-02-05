"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadIncomeEntries } from "@/lib/income";
import { loadJournalEntries } from "@/lib/journal";

const ROUTINE_ITEMS_KEY = "routine-items";
const ROUTINE_DAILY_KEY = "routine-daily";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatNum(n: number): string {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

export function HomeWidgets() {
  const [journalWritten, setJournalWritten] = useState<boolean | null>(null);
  const [routineProgress, setRoutineProgress] = useState<number | null>(null);
  const [monthIncome, setMonthIncome] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadJournalEntries().then((entries) => {
      if (cancelled) return;
      const today = todayStr();
      setJournalWritten(entries.some((e) => e.date === today));
    }).catch(() => {
      if (!cancelled) setJournalWritten(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawItems = window.localStorage.getItem(ROUTINE_ITEMS_KEY);
      const rawDaily = window.localStorage.getItem(ROUTINE_DAILY_KEY);
      const items = rawItems ? (JSON.parse(rawItems) as { id: number }[]) : [];
      const daily = rawDaily ? (JSON.parse(rawDaily) as Record<string, number[]>) : {};
      const todayKey = getTodayKey();
      const completed = daily[todayKey] ?? [];
      const total = Array.isArray(items) ? items.length : 0;
      const pct = total === 0 ? 0 : Math.round((completed.length / total) * 100);
      setRoutineProgress(pct);
    } catch {
      setRoutineProgress(0);
    }
  }, []);

  useEffect(() => {
    const entries = loadIncomeEntries();
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const sum = entries
      .filter((e) => e.year === y && e.month === m)
      .reduce((s, e) => s + e.amount, 0);
    setMonthIncome(sum);
  }, []);

  const baseWidget =
    "widget-grain-texture relative flex min-h-[240px] w-full flex-col rounded-2xl p-5 shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)]";
  const arrowBtn =
    "mt-auto flex items-center justify-center rounded-full bg-white/25 px-4 py-2.5 text-white backdrop-blur-sm transition duration-200 hover:bg-white/40 hover:scale-105";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* 일기 - 네이비 */}
      <Link
        href="/journal"
        className={`${baseWidget} bg-gradient-to-br from-[#1e3a8a] via-[#1e293b] to-[#0f172a]`}
      >
        <span className="absolute right-4 top-4 text-[1.75rem] text-white/80">
          <i className="fa-solid fa-pen-to-square" aria-hidden />
        </span>
        <div className="flex flex-1 flex-col justify-center pt-1">
          <span className="text-sm font-medium text-white/90">오늘 일기</span>
          <span className="mt-1 text-3xl font-bold text-white">
            {journalWritten === null ? "—" : journalWritten ? "작성함" : "미작성"}
          </span>
        </div>
        <span className={arrowBtn} aria-hidden>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H2" />
          </svg>
        </span>
      </Link>

      {/* 루틴 - #F94154 계열 */}
      <Link
        href="/routine"
        className={`${baseWidget} bg-gradient-to-br from-[#F94154] via-[#e63946] to-[#c1121f]`}
      >
        <span className="absolute right-4 top-4 text-[1.75rem] text-white/80">
          <i className="fa-solid fa-circle-check" aria-hidden />
        </span>
        <div className="flex flex-1 flex-col justify-center pt-1">
          <span className="text-sm font-medium text-white/90">오늘 루틴 진행률</span>
          <span className="mt-1 text-3xl font-bold text-white">
            {routineProgress === null ? "—" : `${routineProgress}%`}
          </span>
        </div>
        <span className={arrowBtn} aria-hidden>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H2" />
          </svg>
        </span>
      </Link>

      {/* 수입 - 오렌지 (쨍하게) */}
      <Link
        href="/income"
        className={`${baseWidget} bg-gradient-to-br from-[#fb923c] via-[#f97316] to-[#ea580c]`}
      >
        <span className="absolute right-4 top-4 text-[1.75rem] text-white/80">
          <i className="fa-solid fa-wallet" aria-hidden />
        </span>
        <div className="flex flex-1 flex-col justify-center pt-1">
          <span className="text-sm font-medium text-white/90">이번달 수입</span>
          <span className="mt-1 text-3xl font-bold text-white">
            {monthIncome === null ? "—" : `${formatNum(monthIncome)}원`}
          </span>
        </div>
        <span className={arrowBtn} aria-hidden>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H2" />
          </svg>
        </span>
      </Link>
    </div>
  );
}
