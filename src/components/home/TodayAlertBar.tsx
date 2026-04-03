"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  loadAllAlertItems,
  ALERT_BAR_MOTTO_KEYS,
  type AlertItem,
} from "@/lib/alertBarData";
import { ALERT_BAR_SETTINGS_SYNC_EVENT } from "@/lib/alertBarSettings";

const ROTATE_MS = 60_000;

function shuffleAlerts(items: AlertItem[]): AlertItem[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

function listHasMotto(items: AlertItem[]): boolean {
  return items.some((x) => isMottoAlert(x));
}

function firstMottoIndexFrom(items: AlertItem[], start: number): number {
  const len = items.length;
  for (let k = 0; k < len; k++) {
    const idx = (start + k) % len;
    if (isMottoAlert(items[idx])) return idx;
  }
  return -1;
}

/**
 * 알림 한 줄 (일정·루틴·멘트 등 섞임). 자동 넘김 1분.
 * 멘트 탭 문구는 벽시계 기준 매 시각 구간마다 최소 1번은 슬롯에 포함되도록 보정.
 */
export function TodayAlertBar() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  const hourBucketRef = useRef(Math.floor(Date.now() / 3_600_000));
  const mottoShownInHourRef = useRef(false);

  const hasMultiple = alerts.length > 1;
  const current = alerts.length > 0 ? alerts[index % alerts.length] : null;
  const emptyMessage = "오늘 알림이 없어요. 탭해서 홈을 둘러보세요!";

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      setLoading(true);
      loadAllAlertItems()
        .then((data) => {
          if (!cancelled) {
            setAlerts(shuffleAlerts(data));
            setIndex(0);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    run();
    const onSync = () => run();
    window.addEventListener(ALERT_BAR_SETTINGS_SYNC_EVENT, onSync);
    return () => {
      cancelled = true;
      window.removeEventListener(ALERT_BAR_SETTINGS_SYNC_EVENT, onSync);
    };
  }, []);

  /** 멘트가 화면에 있으면 이번 시(hour) 구간은 채운 것으로 봄(수동 ‹ › 포함) */
  useEffect(() => {
    if (loading || alerts.length === 0) return;
    const item = alerts[index % alerts.length];
    if (isMottoAlert(item)) mottoShownInHourRef.current = true;
  }, [loading, alerts, index]);

  useEffect(() => {
    if (alerts.length <= 1) return;
    const id = window.setTimeout(() => {
      setIndex((i) => {
        const len = alerts.length;
        const hour = Math.floor(Date.now() / 3_600_000);
        if (hour !== hourBucketRef.current) {
          hourBucketRef.current = hour;
          mottoShownInHourRef.current = false;
        }

        let next = (i + 1) % len;

        if (
          !mottoShownInHourRef.current &&
          listHasMotto(alerts) &&
          !isMottoAlert(alerts[next])
        ) {
          const mi = firstMottoIndexFrom(alerts, (i + 1) % len);
          if (mi !== -1) next = mi;
        }

        if (isMottoAlert(alerts[next]) || !listHasMotto(alerts)) {
          mottoShownInHourRef.current = true;
        }

        return next;
      });
    }, ROTATE_MS);
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
      ? "bg-gradient-to-br from-amber-500 via-orange-600 to-orange-800"
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
