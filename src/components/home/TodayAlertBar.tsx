"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { loadAllAlertItems, type AlertItem } from "@/lib/alertBarData";

const ROTATE_INTERVAL_MS = 8000;

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

  const barClass =
    "alert-bar-texture flex min-w-0 items-center gap-2 rounded-full py-1.5 px-4 " +
    "bg-gradient-to-br from-neutral-500 via-neutral-800 to-neutral-950 " +
    "shadow-[0_4px_12px_rgba(0,0,0,0.35),0_2px_6px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]";

  if (loading) {
    return (
      <div className={barClass + " justify-center py-2"}>
        <span className="text-[15px] text-neutral-400 md:text-[17px]">알림 불러오는 중…</span>
      </div>
    );
  }

  const href = current?.type === "schedule" ? current.href : current?.type === "plain" ? current.href : "/";

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
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-white/10 hover:text-neutral-200 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
        aria-label="이전 알림"
      >
        <span className="text-base leading-none md:text-lg">‹</span>
      </button>
      <Link
        href={href}
        className="min-w-0 flex-1 truncate text-left text-[15px] font-medium text-neutral-100 hover:text-white md:text-[17px]"
      >
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
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-white/10 hover:text-neutral-200 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
        aria-label="다음 알림"
      >
        <span className="text-base leading-none md:text-lg">›</span>
      </button>
    </div>
  );
}
