"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { loadMottoTabAlertItems, type AlertItem } from "@/lib/alertBarData";

const MOTTO_ROTATE_MS = 60 * 60 * 1000;

/** 설정「멘트」탭 5문구만, 1시간마다 다음 멘트로 전환 · 오렌지 그라데이ョン */
export function TodayAlertBar() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  const hasMultiple = alerts.length > 1;
  const current = alerts.length > 0 ? alerts[index % alerts.length] : null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadMottoTabAlertItems()
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
    }, MOTTO_ROTATE_MS);
    return () => clearInterval(id);
  }, [hasMultiple, alerts.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + alerts.length) % alerts.length);
  }, [alerts.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % alerts.length);
  }, [alerts.length]);

  const barBase =
    "alert-bar-texture flex min-w-0 items-center gap-2 rounded-full py-1.5 px-4 shadow-[0_4px_14px_rgba(0,0,0,0.08)]";
  const orangeBar =
    barBase +
    " bg-gradient-to-br from-amber-500 via-orange-600 to-orange-950";
  const navBtnClass =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-orange-50/90 transition hover:bg-white/15 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-orange-50/90";
  const linkClass =
    "min-w-0 flex-1 truncate text-left text-[15px] font-medium text-orange-50 hover:text-white md:text-[17px]";

  if (loading) {
    return (
      <div className={barBase + " justify-center py-2 bg-gradient-to-br from-amber-500 via-orange-600 to-orange-950"}>
        <span className="text-[15px] text-orange-100/90 md:text-[17px]">멘트 불러오는 중…</span>
      </div>
    );
  }

  if (alerts.length === 0) return null;

  const href = current?.type === "plain" ? current.href : "/";

  return (
    <div className={orangeBar}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (hasMultiple) goPrev();
        }}
        disabled={!hasMultiple}
        className={navBtnClass}
        aria-label="이전 멘트"
      >
        <span className="text-base leading-none md:text-lg">‹</span>
      </button>
      <Link href={href} className={linkClass}>
        {current?.type === "plain" ? current.text : ""}
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
        aria-label="다음 멘트"
      >
        <span className="text-base leading-none md:text-lg">›</span>
      </button>
    </div>
  );
}
