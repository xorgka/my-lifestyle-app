"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loadScheduleEntries,
  getScheduleItemsInRange,
  type ScheduleItem,
} from "@/lib/scheduleDb";
import { todayStr, addDays } from "@/lib/dateUtil";

const ROTATE_INTERVAL_MS = 5800;

function isToday(dateStr: string, today: string) {
  return dateStr === today;
}

/** 오늘/내일 스케줄 한 건을 문장으로 (예: "오늘은 [설날]이 있어요!", "내일은 [창환 생일]이 있어요!") */
function itemToSentence(item: ScheduleItem, today: string): string {
  const dayLabel = isToday(item.date, today) ? "오늘" : "내일";
  const t = item.title.trim();
  if (!t) return `${dayLabel} 예정이 있어요!`;
  const wrapped = `[${t}]`;
  const last = t.charCodeAt(t.length - 1);
  const hasJong = (last - 0xac00) % 28 !== 0;
  const subject = hasJong ? `${wrapped}이` : `${wrapped}가`;
  return `${dayLabel}은 ${subject} 있어요!`;
}

/** [] 부분에 자간 적용용으로 앞·중간·뒤 분리 */
function itemToSentenceParts(
  item: ScheduleItem,
  today: string
): { prefix: string; bracketed: string; suffix: string } {
  const dayLabel = isToday(item.date, today) ? "오늘" : "내일";
  const t = item.title.trim();
  if (!t) return { prefix: `${dayLabel}은 `, bracketed: "예정", suffix: "이 있어요!" };
  const last = t.charCodeAt(t.length - 1);
  const hasJong = (last - 0xac00) % 28 !== 0;
  return {
    prefix: `${dayLabel}은 `,
    bracketed: t,
    suffix: hasJong ? "이 있어요!" : "가 있어요!",
  };
}

export function TodayAlertBar() {
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof loadScheduleEntries>>>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  const today = todayStr();
  const tomorrow = addDays(today, 1);
  const items = useMemo(
    () => getScheduleItemsInRange(today, tomorrow, entries),
    [today, tomorrow, entries]
  );
  const sentences = useMemo(
    () => items.map((item) => itemToSentence(item, today)),
    [items, today]
  );

  const hasMultiple = sentences.length > 1;
  const emptyMessage = "오늘·내일 예정된 스케줄이 없어요. 탭해서 스케줄을 확인해 보세요!";
  const currentItem = items.length > 0 ? items[index % items.length] : null;
  const sentenceParts = currentItem ? itemToSentenceParts(currentItem, today) : null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadScheduleEntries()
      .then((data) => {
        if (!cancelled) setEntries(data);
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
      setIndex((i) => (i + 1) % sentences.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasMultiple, sentences.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + sentences.length) % sentences.length);
  }, [sentences.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % sentences.length);
  }, [sentences.length]);

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
        href="/schedule"
        className="min-w-0 flex-1 truncate text-left text-[15px] font-medium text-neutral-100 hover:text-white md:text-[17px]"
      >
        {sentenceParts ? (
          <>
            {sentenceParts.prefix}
            <span className="tracking-wider">[{sentenceParts.bracketed}]</span>
            {sentenceParts.suffix}
          </>
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
