"use client";

import { useId, useState, useEffect, useCallback } from "react";
import Link from "next/link";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  return isMobile;
}
import type { DayTimetable, TimetableSlot } from "@/lib/timetableDb";

const baseWidget =
  "widget-grain-texture relative flex min-h-[160px] w-full flex-col rounded-3xl px-7 py-5 shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)]";
const iconPosition = "absolute right-4 top-4 left-auto z-10 text-[1.75rem] text-white/80";

export function DiaryCard({
  journalWritten,
  className = "col-span-1",
}: {
  journalWritten: boolean | null;
  className?: string;
}) {
  return (
    <Link
      href="/journal"
      className={`${className} ${baseWidget} border border-[#1842E2]/30 bg-[#1842E2]`}
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
  );
}

/** "HH:mm" → 분 (0~1439). 24:00 → 1440 아님 0 */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** 취침~기상 수면 시간(시간 단위, 소수 한 자리). 예: 7.5 */
function getSleepHours(bedTime: string, wakeTime: string): number {
  const bed = timeToMinutes(bedTime);
  let wake = timeToMinutes(wakeTime);
  if (wake <= bed) wake += 1440;
  const mins = wake - bed;
  return Math.round((mins / 60) * 10) / 10;
}

/** 수면 호: 24h 원에서 취침~기상 구간만 파란 호. 12시=위, 시계반대방향. */
function SleepArc({
  bedTime,
  wakeTime,
  gradientId,
  size = 88,
  strokeWidth = 10,
  className = "text-blue-500",
}: {
  bedTime: string;
  wakeTime: string;
  gradientId: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const bed = timeToMinutes(bedTime);
  let wake = timeToMinutes(wakeTime);
  if (wake <= bed) wake += 1440;
  const duration = wake - bed;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circum = 2 * Math.PI * r;
  /* 12시간 = 한 바퀴. 12시 방향이 위(0시). 취침 위치 = 12h 기준 각도, 호 길이 = 수면시간/12h */
  const MINUTES_PER_ROTATION = 720; // 12h
  const startRatio = (bed % MINUTES_PER_ROTATION) / MINUTES_PER_ROTATION;
  const lengthRatio = Math.min(1, duration / MINUTES_PER_ROTATION);
  const dashLength = lengthRatio * circum;
  const gapLength = (1 - lengthRatio) * circum;
  const offset = -startRatio * circum;

  return (
    <svg width={size} height={size} className={className} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#93c5fd" />
        </linearGradient>
      </defs>
      {/* 회색: 12시간 한 바퀴 트랙 */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-neutral-200"
      />
      {/* 파란 호: 수면 구간 (12h 기준, 그라데이션) */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${dashLength} ${gapLength}`}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        stroke={`url(#${gradientId})`}
        className="sleep-arc"
      />
    </svg>
  );
}

export function SleepCard({
  bedTime,
  wakeTime,
  className = "col-span-1",
}: {
  bedTime?: string;
  wakeTime?: string;
  className?: string;
}) {
  const hasData = bedTime && wakeTime;
  const gradientId = useId();
  const isMobile = useIsMobile();
  const [mobilePage, setMobilePage] = useState(0);

  const handleMobileTap = useCallback(
    (e: React.MouseEvent) => {
      if (isMobile) {
        e.preventDefault();
        setMobilePage((p) => 1 - p);
      }
    },
    [isMobile]
  );

  const timeBlock = (
    <div className="flex shrink-0 flex-col justify-center text-left">
      <div className="border-b border-neutral-200 pb-2 transition-colors group-hover:border-white/40">
        <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 transition-colors group-hover:text-white">Sleep</p>
        <p className="text-lg font-bold tabular-nums text-neutral-900 transition-colors group-hover:text-white">{bedTime ?? "—"}</p>
      </div>
      <div className="mt-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 transition-colors group-hover:text-white">Wake</p>
        <p className="text-lg font-bold tabular-nums text-neutral-900 transition-colors group-hover:text-white">{wakeTime ?? "—"}</p>
      </div>
    </div>
  );

  const arcBlock = (
    <div className="relative flex h-[112px] w-[112px] shrink-0 items-center justify-center [filter:drop-shadow(0_2px_6px_rgba(0,0,0,0.06))] [&_.stroke-neutral-200]:transition-colors [&_.stroke-neutral-200]:group-hover:stroke-white/30 [&_.sleep-arc]:transition-colors [&_.sleep-arc]:group-hover:stroke-white">
      {hasData ? (
        <>
          <SleepArc bedTime={bedTime!} wakeTime={wakeTime!} gradientId={gradientId} size={112} strokeWidth={20} className="text-blue-500" />
          <span className="absolute inset-0 flex items-center justify-center text-xl font-bold tabular-nums text-neutral-400 transition-colors group-hover:text-white sm:text-2xl">
            {getSleepHours(bedTime, wakeTime)}
          </span>
        </>
      ) : (
        <div className="flex h-[112px] w-[112px] items-center justify-center rounded-full border-2 border-dashed border-neutral-200 text-neutral-300" aria-hidden>
          <span className="text-xs">—</span>
        </div>
      )}
    </div>
  );

  return (
    <Link
      href="/routine/sleep"
      onClick={handleMobileTap}
      className={`group relative ${className} flex min-h-[180px] min-w-0 flex-col items-center justify-center overflow-hidden rounded-3xl border border-neutral-200/90 bg-white px-6 py-5 shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_2px_4px_rgba(0,0,0,0.02),0_6px_12px_rgba(0,0,0,0.05),0_10px_24px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-1.5 hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-500 hover:to-blue-600 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_12px_28px_rgba(59,130,246,0.4)] sm:flex-row`}
    >
      <span className="absolute right-4 top-4 text-xl text-neutral-300/80 transition-colors group-hover:text-white" aria-hidden>🌙</span>
      {/* 모바일: 탭 시 1↔2페이지 전환. 데스크톱: 둘 다 나란히 */}
      <div className={`flex shrink-0 items-center gap-8 sm:gap-10 ${isMobile ? "w-full justify-center" : ""}`}>
        {isMobile ? (
          <>
            <div className={mobilePage === 0 ? "flex shrink-0 flex-col" : "hidden"}>{timeBlock}</div>
            <div className={mobilePage === 1 ? "flex shrink-0 items-center justify-center" : "hidden"}>{arcBlock}</div>
          </>
        ) : (
          <>
            {timeBlock}
            {arcBlock}
          </>
        )}
      </div>
    </Link>
  );
}

export function RoutineCard({
  routineProgress,
  routineCompleted,
  routineTotal,
  className = "col-span-1",
}: {
  routineProgress: number | null;
  routineCompleted?: number;
  routineTotal?: number;
  className?: string;
}) {
  const [showPercent, setShowPercent] = useState(false);
  const hasCount = routineCompleted != null && routineTotal != null;
  const canToggle = hasCount && routineTotal > 0;

  useEffect(() => {
    try {
      const stored = localStorage.getItem("home-routine-display-percent");
      if (stored === "true") setShowPercent(true);
    } catch {
      // ignore
    }
  }, []);

  const handleNumberClick = (e: React.MouseEvent) => {
    if (!canToggle) return;
    e.preventDefault();
    e.stopPropagation();
    setShowPercent((p) => {
      const next = !p;
      try {
        localStorage.setItem("home-routine-display-percent", next ? "true" : "false");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const displayPercent =
    routineProgress != null ? routineProgress : hasCount && routineTotal! > 0
      ? Math.round((routineCompleted! / routineTotal!) * 100)
      : null;

  const progressPct = displayPercent != null ? displayPercent : 0;

  return (
    <Link
      href="/routine"
      className={`group ${className} flex min-h-[180px] min-w-0 flex-col items-center justify-center gap-0 rounded-3xl border border-neutral-200/90 bg-white px-4 py-5 shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_2px_4px_rgba(0,0,0,0.02),0_6px_12px_rgba(0,0,0,0.05),0_10px_24px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-1.5 hover:border-[#1CBD87] hover:bg-[#1CBD87] hover:shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_12px_28px_rgba(28,189,135,0.4)]`}
    >
      <span className="text-sm font-medium text-emerald-500/90 transition-colors group-hover:text-white">Routine</span>
      <div className="mt-1.5 w-full max-w-[88px] overflow-hidden rounded-full bg-neutral-200/80 transition-colors group-hover:bg-white/30">
        <div
          className="h-1.5 rounded-full bg-emerald-500/80 transition-all duration-300 group-hover:bg-white"
          style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
        />
      </div>
      <button
        type="button"
        onClick={handleNumberClick}
        className="mt-1.5 flex cursor-pointer items-baseline justify-center gap-0.5 rounded-lg py-1 pr-1 pl-1 transition disabled:cursor-default group-hover:text-white"
        disabled={!canToggle}
        aria-label={canToggle ? (showPercent ? "개수 표시로 전환" : "퍼센트 표시로 전환") : undefined}
      >
        {hasCount && !showPercent ? (
          <>
            <span className="text-4xl font-bold text-emerald-600 transition-colors group-hover:text-white md:text-5xl">{routineCompleted}</span>
            <span className="text-3xl font-semibold text-emerald-500/90 transition-colors group-hover:text-white md:text-4xl">/</span>
            <span className="text-3xl font-semibold text-emerald-500/90 transition-colors group-hover:text-white md:text-4xl">{routineTotal}</span>
          </>
        ) : (
          <span className="flex items-baseline justify-center gap-0.5">
            <span className="text-4xl font-bold text-emerald-600 transition-colors group-hover:text-white md:text-5xl">
              {displayPercent === null ? "—" : displayPercent}
            </span>
            {displayPercent !== null && (
              <span className="text-xl font-semibold text-emerald-500/90 transition-colors group-hover:text-white md:text-2xl">%</span>
            )}
          </span>
        )}
      </button>
    </Link>
  );
}

type TimetableCardProps = {
  dayTimetable: DayTimetable | null;
  currentSlot: TimetableSlot | null;
  /** 시작시간 오버라이드 적용 시 표시할 시각(0~23). 없으면 currentSlot.time 사용 */
  currentSlotDisplayHour: number | null;
  completedIds: string[];
  nextSlotHour: number;
  remainingText: string | null;
  onToggle: (itemId: string) => void;
  /** A = 기존 오렌지 풀폭. B = 흰 박스 + 왼쪽 작은 시간 정사각형(그림자) + 오른쪽 리스트 */
  variant?: "A" | "B";
  className?: string;
};

const timeBoxShadow = "shadow-[0_2px_8px_rgba(0,0,0,0.15)]";

export function TimetableCard({
  dayTimetable,
  currentSlot,
  currentSlotDisplayHour,
  completedIds,
  nextSlotHour,
  remainingText,
  onToggle,
  variant = "A",
  className = "col-span-2",
}: TimetableCardProps) {
  const displayHour = currentSlotDisplayHour ?? (currentSlot ? Number(currentSlot.time) : null);
  const isB = variant === "B";

  const itemList = (slot: TimetableSlot) => (
    <ul className="min-w-0 flex-1 overflow-auto bg-white pt-0.5 pr-2 pb-[5px]">
              {slot.items.length === 0 ? (
                <li className="border-b border-neutral-200 px-3 py-2.5 text-[15px] text-neutral-500">
                  항목 없음
                </li>
              ) : (
                slot.items.map((item) => {
                  const isCompleted = completedIds.includes(item.id);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2.5 last:border-b-0"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span
                          className={`flex shrink-0 ${isCompleted ? "text-neutral-300" : "text-neutral-400"}`}
                          aria-hidden
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </span>
                        <span
                          className={`min-w-0 truncate text-[16px] font-semibold leading-snug ${isCompleted ? "text-neutral-300 line-through" : "text-neutral-800"}`}
                        >
                          {item.text || "항목"}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onToggle(item.id);
                        }}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                          isCompleted
                            ? "border-neutral-700 bg-neutral-700 text-white"
                            : "border-neutral-300 bg-transparent hover:border-neutral-400"
                        }`}
                        aria-label={isCompleted ? "완료 해제" : "완료"}
                      >
                        {isCompleted && (
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </li>
                  );
                })
              )}
    </ul>
  );

  const emptyState = (
    <div className={`flex flex-1 flex-col justify-center px-5 py-4 ${isB ? "text-neutral-600" : "text-white/90"}`}>
      <span className="text-sm font-medium">타임테이블</span>
      <span className="mt-1 text-2xl font-bold">오늘 시간대</span>
    </div>
  );

  const content = currentSlot
    ? isB
      ? (
          <div className="flex min-h-0 min-w-0 flex-1 items-center gap-4 p-4 pr-0">
            <div
              className={`flex aspect-square h-[116px] w-[116px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-3xl bg-[#F19E36] py-2 px-2 md:h-[128px] md:w-[128px] ${timeBoxShadow}`}
            >
              {remainingText != null && (
                <span
                  className="text-xs font-medium tabular-nums text-white/90"
                  title={nextSlotHour >= 24 ? `내일 ${nextSlotHour - 24}시까지` : `${nextSlotHour}시까지`}
                >
                  {remainingText}
                </span>
              )}
              <span className="text-4xl font-bold text-white md:text-5xl">
                {nextSlotHour >= 24 ? nextSlotHour - 24 : nextSlotHour}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col">{itemList(currentSlot)}</div>
          </div>
        )
      : (
          <div className="flex min-h-0 min-w-0 flex-1 bg-white/95">
            <div className="flex w-28 shrink-0 flex-col items-center justify-center gap-1 border-r border-[#F19E36]/40 bg-[#F19E36] py-3 md:w-32">
              <span className="text-2xl font-bold text-white md:text-3xl">
                {displayHour != null ? `${displayHour}시` : `${Number(currentSlot.time)}시`}
              </span>
              {remainingText != null && (
                <span
                  className="text-sm font-medium tabular-nums text-white md:text-base"
                  title={`다음 ${nextSlotHour >= 24 ? `내일 ${nextSlotHour - 24}시` : `${nextSlotHour}시`}까지`}
                >
                  {remainingText}
                </span>
              )}
            </div>
            {itemList(currentSlot)}
          </div>
        )
    : emptyState;

  return (
    <Link
      href="/routine/timetable"
      className={`${className} flex max-h-[180px] min-h-[180px] min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_12px_28px_rgba(0,0,0,0.18)] ${
        isB
          ? "widget-grain-texture border-neutral-200/90 bg-white shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_2px_4px_rgba(0,0,0,0.02),0_6px_12px_rgba(0,0,0,0.05),0_10px_24px_rgba(0,0,0,0.04)]"
          : "widget-grain-texture relative border-neutral-200/90 bg-[#F19E36] shadow-[0_1px_0_0_rgba(255,255,255,0.3)_inset,0_2px_4px_rgba(0,0,0,0.02),0_6px_12px_rgba(0,0,0,0.05),0_10px_24px_rgba(0,0,0,0.04)]"
      }`}
    >
      {!isB && (
        <span className={iconPosition}>
          <i className="fa-solid fa-table-cells" aria-hidden />
        </span>
      )}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {content}
      </div>
    </Link>
  );
}
