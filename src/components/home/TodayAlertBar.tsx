"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { loadAllAlertItems, type AlertItem } from "@/lib/alertBarData";

const ROTATE_INTERVAL_MS = 8000;

/** 오늘/내일 일정, 사전 알림, 생일(스케줄 탭) 등 스케줄 페이지로 이어지는 알림 */
function isScheduleRelatedAlert(item: AlertItem | null): boolean {
  if (!item) return false;
  if (item.type === "schedule") return true;
  if (item.type === "plain" && item.href === "/schedule") return true;
  return false;
}

export function TodayAlertBar() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  const hasMultiple = alerts.length > 1;
  const current = alerts.length > 0 ? alerts[index % alerts.length] : null;
  const emptyMessage = "오늘 알림이 없어요. 탭해서 홈을 둘러보세요!";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadAllAlertItems()
      .then((data) => {
        if (!cancelled) setAlerts(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasMultiple) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % alerts.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasMultiple, alerts.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + alerts.length) % alerts.length);
  }, [alerts.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % alerts.length);
  }, [alerts.length]);

  const scheduleTheme = !loading && isScheduleRelatedAlert(current);
  const barBase =
    "alert-bar-texture flex min-w-0 items-center gap-2 rounded-full py-1.5 px-4 shadow-[0_4px_14px_rgba(0,0,0,0.08)]";
  const barTheme = scheduleTheme
    ? "bg-gradient-to-br from-red-600 via-red-800 to-red-950"
    : "bg-gradient-to-br from-neutral-500 via-neutral-800 to-neutral-950";
  const barClass = `${barBase} ${barTheme}`;

  const navBtnClass = scheduleTheme
    ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-100/85 transition hover:bg-white/15 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-red-100/85"
    : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-white/10 hover:text-neutral-200 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-400";

  const linkClass = scheduleTheme
    ? "min-w-0 flex-1 truncate text-left text-[15px] font-medium text-red-50 hover:text-white md:text-[17px]"
    : "min-w-0 flex-1 truncate text-left text-[15px] font-medium text-neutral-100 hover:text-white md:text-[17px]";

  if (loading) {
    return (
      <div className={barBase + " justify-center py-2 bg-gradient-to-br from-neutral-500 via-neutral-800 to-neutral-950"}>
        <span className="text-[15px] text-neutral-400 md:text-[17px]">알림 불러오는 중…</span>
      </div>
    );
  }

  const href =
    current && (current.type === "schedule" || current.type === "plain") ? current.href : "/";

  return (
    <div className={barClass}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (hasMultiple) goPrev();
        }}
        disabled={!hasMultiple}
        className={navBtnClass}
        aria-label="이전 알림"
      >
        <span className="text-base leading-none md:text-lg">‹</span>
      </button>
      <Link href={href} className={linkClass}>
        {current?.type === "schedule" ? (
          <>
            {current.prefix}
            <span className="tracking-wider">[{current.bracketed}]</span>
            {current.suffix}
          </>
        ) : current?.type === "plain" ? (
          current.text
        ) : (
          emptyMessage
        )}
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (hasMultiple) goNext();
        }}
        disabled={!hasMultiple}
        className={navBtnClass}
        aria-label="다음 알림"
      >
        <span className="text-base leading-none md:text-lg">›</span>
      </button>
    </div>
  );
}
