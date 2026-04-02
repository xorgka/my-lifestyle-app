"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  loadAllAlertItems,
  ALERT_BAR_MOTTO_KEYS,
  type AlertItem,
} from "@/lib/alertBarData";

const SYSTEM_ROTATE_MS = 8000;
const MOTTO_ROTATE_MS = 60 * 60 * 1000;

function isScheduleRelatedAlert(item: AlertItem | null): boolean {
  if (!item) return false;
  if (item.type === "schedule") return true;
  if (item.type === "plain" && item.href === "/schedule") return true;
  return false;
}

function isMottoAlert(item: AlertItem | null): boolean {
  if (!item || item.type !== "plain") return false;
  const k = item.systemKey;
  return !!k && ALERT_BAR_MOTTO_KEYS.has(k);
}

/**
 * 알림 한 줄: 일정·루틴 등 + 멘트 탭 5종.
 * 멘트가 뜬 구간만 1시간 간격, 나머지는 8초 간격으로 다음 항목으로 넘김.
 */
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
        if (!cancelled) {
          setAlerts(data);
          setIndex(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (alerts.length <= 1) return;
    const item = alerts[index % alerts.length];
    const ms = isMottoAlert(item) ? MOTTO_ROTATE_MS : SYSTEM_ROTATE_MS;
    const id = window.setTimeout(() => {
      setIndex((i) => (i + 1) % alerts.length);
    }, ms);
    return () => clearTimeout(id);
  }, [alerts, index, alerts.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + alerts.length) % alerts.length);
  }, [alerts.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % alerts.length);
  }, [alerts.length]);

  const scheduleTheme = !loading && isScheduleRelatedAlert(current);
  const mottoTheme = !loading && !scheduleTheme && isMottoAlert(current);
  const barBase =
    "alert-bar-texture flex min-w-0 items-center gap-2 rounded-full py-1.5 px-4 shadow-[0_4px_14px_rgba(0,0,0,0.08)]";
  const barTheme = scheduleTheme
    ? "bg-gradient-to-br from-red-600 via-red-800 to-red-950"
    : mottoTheme
      ? "bg-gradient-to-br from-amber-500 via-orange-600 to-orange-950"
      : "bg-gradient-to-br from-neutral-500 via-neutral-800 to-neutral-950";
  const barClass = `${barBase} ${barTheme}`;

  const navBtnClass = scheduleTheme
    ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-100/85 transition hover:bg-white/15 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-red-100/85"
    : mottoTheme
      ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-orange-50/90 transition hover:bg-white/15 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-orange-50/90"
      : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-white/10 hover:text-neutral-200 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-400";

  const linkClass = scheduleTheme
    ? "min-w-0 flex-1 truncate text-left text-[15px] font-medium text-red-50 hover:text-white md:text-[17px]"
    : mottoTheme
      ? "min-w-0 flex-1 truncate text-left text-[15px] font-medium text-orange-50 hover:text-white md:text-[17px]"
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
