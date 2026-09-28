"use client";

import { useId, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { loadSetting, saveSetting, USER_SETTINGS_SYNC_EVENT } from "@/lib/userSettings";

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
      className={`group relative ${className} flex min-h-[170px] min-w-0 flex-col items-center justify-center overflow-hidden rounded-3xl border border-neutral-200/90 bg-white px-6 py-5 shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_2px_4px_rgba(0,0,0,0.02),0_6px_12px_rgba(0,0,0,0.05),0_10px_24px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-1.5 hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-500 hover:to-blue-600 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_12px_28px_rgba(59,130,246,0.4)] sm:flex-row`}
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
    const read = () => setShowPercent(loadSetting<boolean>("home-routine-display-percent", false) === true);
    read();
    window.addEventListener(USER_SETTINGS_SYNC_EVENT, read);
    return () => window.removeEventListener(USER_SETTINGS_SYNC_EVENT, read);
  }, []);

  const handleNumberClick = (e: React.MouseEvent) => {
    if (!canToggle) return;
    e.preventDefault();
    e.stopPropagation();
    setShowPercent((p) => {
      const next = !p;
      saveSetting("home-routine-display-percent", next);
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
      href="/routine/list"
      className={`group ${className} flex min-h-[170px] min-w-0 flex-col items-center justify-center gap-0 rounded-3xl border border-neutral-200/90 bg-white px-4 py-5 shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_2px_4px_rgba(0,0,0,0.02),0_6px_12px_rgba(0,0,0,0.05),0_10px_24px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-1.5 hover:border-[#1CBD87] hover:bg-[#1CBD87] hover:shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_12px_28px_rgba(28,189,135,0.4)]`}
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
      href="/routine"
      className={`${className} flex max-h-[170px] min-h-[170px] min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border transition duration-200 hover:-translate-y-1.5 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_12px_28px_rgba(0,0,0,0.18)] ${
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

/**
 * 달력 템플릿용 오늘 타임라인: 가로 시간축 위에 시간대마다 점·시작 시각, 아래에 그 시간대 할 일(동그란 체크).
 * 지금 시간대만 주황 점 + 남은 시간 + 어두운 카드로 강조, 앞뒤 시간대는 글자만 연하게.
 */
export function TodayTimelinePanel({
  timelineSlots,
  currentSlotId,
  completedIds,
  remainingText,
  onToggle,
  className = "",
}: {
  timelineSlots: { slot: TimetableSlot; start: number; end: number | null }[];
  currentSlotId: string | null;
  completedIds: string[];
  remainingText: string | null;
  onToggle: (itemId: string) => void;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  /** 지금 칸 최대 폭 = 보이는 영역 폭 - 좌우 여백 - 카드가 왼쪽으로 삐져나온 16px. 넘치면 칸 안에서 줄바꿈 → 폰에서도 지금 할 일이 다 보이고 양 끝 흐림에 안 가려짐 */
  const [currentMaxWidth, setCurrentMaxWidth] = useState<number | null>(null);
  const currentIndex = timelineSlots.findIndex((t) => t.slot.id === currentSlotId);

  useEffect(() => {
    const box = scrollRef.current;
    const track = trackRef.current;
    if (!box || !track) return;
    const measure = () => {
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      setCurrentMaxWidth(box.clientWidth - pad * 2 - 16);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [timelineSlots.length]);

  // 열 때·시간대가 바뀔 때·폭이 바뀔 때 지금 칸(어두운 카드 기준, 슬롯보다 왼쪽으로 16px 나옴)이 가운데 오게.
  // 부드러운 스크롤은 연달아 호출되면 도중에 끊겨 가운데까지 못 가서 바로 이동
  useEffect(() => {
    const box = scrollRef.current;
    const cur = currentRef.current;
    if (!box || !cur) return;
    const left = cur.offsetLeft - 16;
    const width = cur.offsetWidth + 16;
    box.scrollLeft = left - (box.clientWidth - width) / 2;
  }, [currentSlotId, timelineSlots.length, currentMaxWidth]);

  const scrollByPage = (dir: -1 | 1) => {
    const box = scrollRef.current;
    if (box) box.scrollBy({ left: dir * box.clientWidth * 0.6, behavior: "smooth" });
  };

  const arrowClass =
    "absolute top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-500 opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition hover:text-neutral-900 group-hover:opacity-100 md:flex";

  return (
    <div
      className={`group relative min-w-0 overflow-hidden rounded-3xl bg-white shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_2px_4px_rgba(0,0,0,0.02),0_6px_12px_rgba(0,0,0,0.05),0_10px_24px_rgba(0,0,0,0.04)] ${className}`}
    >
      {timelineSlots.length === 0 ? (
        <Link href="/routine" className="block px-6 py-5 text-[15px] font-medium text-neutral-500 hover:text-neutral-700">
          오늘 타임테이블이 없어요
        </Link>
      ) : (
        <>
          <div ref={scrollRef} className="overflow-x-auto scrollbar-hide">
            <div ref={trackRef} className="relative flex w-max items-start gap-9 px-8 pb-5 pt-4 md:gap-11 md:px-12">
              {/* 시간축: 점·시각 줄의 세로 가운데 = 위 여백(1rem) + 줄 높이 절반(0.75rem) */}
              <span className="pointer-events-none absolute inset-x-0 top-[1.75rem] h-px -translate-y-1/2 bg-neutral-200" aria-hidden />
              {timelineSlots.map(({ slot, start }, i) => {
                const isCurrent = i === currentIndex;
                const isPast = currentIndex >= 0 && i < currentIndex;
                const items =
                  slot.items.length === 0 ? (
                    <p className={`text-[14px] leading-6 ${isCurrent ? "text-white/50" : "text-neutral-300"}`}>할 일 없음</p>
                  ) : (
                    <ul className={`flex items-center gap-x-4 gap-y-2 ${isCurrent ? "flex-wrap" : ""}`}>
                      {slot.items.map((item) => {
                        const checked = completedIds.includes(item.id);
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => onToggle(item.id)}
                              className="flex items-center gap-2 whitespace-nowrap text-left"
                              aria-label={checked ? `${item.text || "항목"} 완료 해제` : `${item.text || "항목"} 완료`}
                            >
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                                  checked
                                    ? isCurrent
                                      ? "border-white bg-white text-neutral-900"
                                      : "border-neutral-300 bg-neutral-300 text-white"
                                    : isCurrent
                                      ? "border-white/45"
                                      : "border-neutral-300"
                                }`}
                                aria-hidden
                              >
                                {checked && (
                                  <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </span>
                              <span
                                className={`text-[14px] leading-6 ${
                                  checked
                                    ? `line-through ${isCurrent ? "text-white/40" : "text-neutral-300"}`
                                    : isCurrent
                                      ? "font-semibold text-white"
                                      : isPast
                                        ? "font-medium text-neutral-400"
                                        : "font-medium text-neutral-500"
                                }`}
                              >
                                {item.text || "항목"}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  );
                return (
                  <div
                    key={slot.id}
                    ref={isCurrent ? currentRef : undefined}
                    // 지금 칸은 양 끝 흐림보다 위에 둬서 폰에서 가장자리까지 와도 안 가려지게
                    className={`relative shrink-0 ${isCurrent ? "z-[6]" : ""}`}
                    style={isCurrent && currentMaxWidth ? { maxWidth: currentMaxWidth } : undefined}
                  >
                    {/* 점 + 시각을 시간축 선 위 한 줄에. 흰 배경으로 뒤의 선을 가려 글자가 선 위에 얹힌 모양 */}
                    <div className="relative z-[1] flex h-6 w-fit items-center gap-2 bg-white pr-2.5">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${isCurrent ? "bg-[#F19E36] ring-4 ring-[#FBE3C4]" : "bg-neutral-300"}`}
                        aria-hidden
                      />
                      <span className={`text-[14px] font-bold tabular-nums ${isCurrent ? "ml-0.5 text-neutral-900" : "text-neutral-400"}`}>
                        {start}시
                      </span>
                      {isCurrent && remainingText != null && (
                        <span className="rounded-full bg-[#FBE3C4] px-2 py-px text-[12px] font-semibold tabular-nums text-[#9A5B0E]">
                          {remainingText} 남음
                        </span>
                      )}
                    </div>
                    {/* 지금 칸은 어두운 카드, 나머지는 같은 세로 여백만 줘서 할 일 줄 높이를 맞춤 */}
                    {isCurrent ? <div className="-ml-4 mt-2.5 rounded-2xl bg-neutral-900 px-4 py-3">{items}</div> : <div className="mt-2.5 py-3">{items}</div>}
                  </div>
                );
              })}
            </div>
          </div>
          {/* 양 끝을 흐리게 → 옆에 시간대가 더 있다는 표시 */}
          <span className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-16 bg-gradient-to-r from-white via-white/80 to-transparent md:w-32" aria-hidden />
          <span className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-16 bg-gradient-to-l from-white via-white/80 to-transparent md:w-32" aria-hidden />
          {/* PC: 마우스를 올리면 좌우 넘기기 버튼 */}
          <button type="button" onClick={() => scrollByPage(-1)} className={`${arrowClass} left-2`} aria-label="이전 시간대">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button type="button" onClick={() => scrollByPage(1)} className={`${arrowClass} right-2`} aria-label="다음 시간대">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
