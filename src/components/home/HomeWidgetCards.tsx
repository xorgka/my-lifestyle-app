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

/** "1:05:30" → "1h 5min", "0:50:41" → "50min" (초는 버림) */
function toMinuteText(hms: string): string {
  const [h, m] = hms.split(":").map((v) => parseInt(v, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hms;
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  return `${m}min`;
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
  /** 트랙 좌우 여백 = 보이는 폭의 절반. 어느 시간대든 가운데에 놓을 수 있게 한다 */
  const [sidePad, setSidePad] = useState(0);
  const currentIndex = timelineSlots.findIndex((t) => t.slot.id === currentSlotId);

  useEffect(() => {
    const box = scrollRef.current;
    const track = trackRef.current;
    if (!box || !track) return;
    const measure = () => {
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      setCurrentMaxWidth(Math.max(180, box.clientWidth - 112));
      setSidePad(box.clientWidth / 2);
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
    const left = cur.offsetLeft;
    const width = cur.offsetWidth;
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
      className={`group relative min-w-0 overflow-hidden ${className}`}
    >
      {timelineSlots.length === 0 ? (
        <Link href="/routine" className="block px-6 py-5 text-[15px] font-medium text-neutral-500 hover:text-neutral-700">
          오늘 타임테이블이 없어요
        </Link>
      ) : (
        <>
          <div ref={scrollRef} className="snap-x snap-mandatory overflow-x-auto scrollbar-hide">
            <div ref={trackRef} className="relative flex w-max items-center gap-3 px-8 py-8 md:gap-6 md:px-12">
              <span className="shrink-0" style={{ width: sidePad }} aria-hidden />
              {timelineSlots.map(({ slot, start, end }, i) => {
                const isCurrent = i === currentIndex;
                const isPast = currentIndex >= 0 && i < currentIndex;
                /** 지금 시간대가 얼마나 지났는지(%) — 캡슐이 차오르는 데 쓴다 */
                let elapsedPct = 0;
                if (isCurrent && end != null && end > start) {
                  const d = new Date();
                  const nowH = d.getHours() + d.getMinutes() / 60;
                  const cur = nowH < start ? nowH + 24 : nowH;
                  elapsedPct = Math.min(100, Math.max(0, ((cur - start) / (end - start)) * 100));
                }
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
                    className={`relative shrink-0 snap-center transition-opacity duration-300 ${
                      currentIndex < 0
                        ? ""
                        : isCurrent
                          ? "z-[6]"
                          : Math.abs(i - currentIndex) === 1
                            ? "opacity-70"
                            : "opacity-40"
                    }`}
                    style={isCurrent && currentMaxWidth ? { maxWidth: currentMaxWidth } : undefined}
                  >
                    {/* 시각·할 일·남은 시간을 캡슐 하나에 */}
                    <div
                      className={`flex items-center gap-4 rounded-full ${
                        isCurrent
                          ? "bg-neutral-900 px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
                          : isPast
                            ? "bg-neutral-100/60 px-4 py-3"
                            : "bg-neutral-100 px-4 py-3"
                      }`}
                    >
                      {/* 시각 · 남은 시간을 한 덩어리로 묶어 캡슐 왼쪽에 */}
                      <div className={`relative flex shrink-0 items-center gap-2 ${isCurrent ? "overflow-hidden rounded-full bg-[#F19E36]/25 px-3 py-1.5" : ""}`}>
                        {/* 알약 자체가 게이지 — 이 시간대가 지나간 만큼 차오른다 */}
                        {isCurrent && (
                          <span className="pointer-events-none absolute inset-y-0 left-0 bg-[#F19E36]/85" style={{ width: `${elapsedPct}%` }} aria-hidden />
                        )}
                        <Link
                          href="/routine"
                          className={`relative -my-2 py-2 text-[14px] font-bold tabular-nums ${isCurrent ? "text-white" : "text-neutral-400"}`}
                          aria-label={`${start}시 일과 보기`}
                        >
                          {start}시
                        </Link>
                        {isCurrent && remainingText != null && (
                          <>
                            <span className="relative h-3 w-px shrink-0 bg-white/40" aria-hidden />
                            <span className="relative text-[12px] font-semibold tabular-nums text-white/85">{toMinuteText(remainingText)}</span>
                          </>
                        )}
                      </div>
                      <div className="relative min-w-0">{items}</div>
                    </div>
                  </div>
                );
              })}
              <span className="shrink-0" style={{ width: sidePad }} aria-hidden />
            </div>
          </div>
          {/* 양 끝을 흐리게 → 옆에 시간대가 더 있다는 표시 */}
          <span className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-6 bg-gradient-to-r from-white/90 to-transparent md:w-12" aria-hidden />
          <span className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-6 bg-gradient-to-l from-white/90 to-transparent md:w-12" aria-hidden />
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

/**
 * 오늘 타임라인 (축 형태) — 가로 축 위에 할 일마다 점을 찍고,
 * 시간대가 시작하는 자리에 시각을 적는다. 지금 위치는 주황 점 + 남은 시간.
 */
export function TodayTimelineAxisPanel({
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
  const nowRef = useRef<HTMLDivElement>(null);
  const currentEndRef = useRef<HTMLDivElement>(null);
  const [sidePad, setSidePad] = useState(0);

  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const measure = () => setSidePad(box.clientWidth / 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  // 지금 시간 구간(시각 + 그 시간대 할 일) 전체가 항상 가운데 오게
  useEffect(() => {
    const box = scrollRef.current;
    const now = nowRef.current;
    if (!box || !now) return;
    const endEl = currentEndRef.current;
    const left = now.offsetLeft;
    const right = endEl ? endEl.offsetLeft + endEl.offsetWidth : now.offsetLeft + now.offsetWidth;
    box.scrollLeft = (left + right) / 2 - box.clientWidth / 2;
  }, [currentSlotId, timelineSlots.length, sidePad]);

  const scrollByPage = (dir: -1 | 1) => {
    const box = scrollRef.current;
    if (box) box.scrollBy({ left: dir * box.clientWidth * 0.6, behavior: "smooth" });
  };

  const arrowClass =
    "absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-500 opacity-0 shadow-[0_2px_10px_rgba(0,0,0,0.14)] transition hover:text-neutral-900 group-hover:opacity-100 md:flex";

  const currentIndex = timelineSlots.findIndex((t) => t.slot.id === currentSlotId);

  type SlotItem = TimetableSlot["items"][number];
  type Node =
    | { kind: "now"; key: string; hour: number; isEnd?: boolean }
    | { kind: "empty"; key: string; hour: number; tone: "past" | "future"; isEnd?: boolean }
    | { kind: "item"; key: string; hour: number | null; item: SlotItem; tone: "past" | "current" | "future"; isEnd?: boolean };

  const nodes: Node[] = [];
  timelineSlots.forEach(({ slot, start }, i) => {
    const isCurrent = i === currentIndex;
    const tone: "past" | "current" | "future" =
      currentIndex < 0 ? "future" : isCurrent ? "current" : i < currentIndex ? "past" : "future";
    // 지금 시간대는 시각을 주황 점이 달고, 할 일은 그 뒤로 이어진다
    if (isCurrent) nodes.push({ kind: "now", key: `now-${slot.id}`, hour: start });
    if (slot.items.length === 0) {
      nodes.push({
        kind: "empty",
        key: `empty-${slot.id}`,
        hour: start,
        tone: tone === "current" ? "future" : tone,
      });
      return;
    }
    slot.items.forEach((item, idx) => {
      nodes.push({
        kind: "item",
        key: `${slot.id}-${item.id}`,
        hour: idx === 0 && !isCurrent ? start : null,
        item,
        tone,
      });
    });
    // 이 시간대가 지금이면 마지막 노드를 구간의 끝으로 표시
    if (isCurrent) nodes[nodes.length - 1].isEnd = true;
  });

  return (
    <div className={`group relative min-w-0 overflow-hidden ${className}`}>
      {timelineSlots.length === 0 ? (
        <Link href="/routine" className="block px-6 py-5 text-[17px] font-medium text-neutral-500 hover:text-neutral-700">
          오늘 타임테이블이 없어요
        </Link>
      ) : (
        <>
        <div ref={scrollRef} className="overflow-x-auto scrollbar-hide">
          <div className="relative flex w-max items-start px-8 py-6 md:px-12">
            {/* 축: 위 여백(1.5rem) + 시각 줄(1.5rem) + 점 줄 절반(0.75rem) */}
            <span className="pointer-events-none absolute inset-x-0 top-[3.75rem] h-px -translate-y-1/2 bg-neutral-200" aria-hidden />
            <span className="shrink-0" style={{ width: sidePad }} aria-hidden />
            {nodes.map((node) => {
              if (node.kind === "now") {
                return (
                  <div key={node.key} ref={nowRef} className="flex shrink-0 flex-col items-center px-3 md:px-5">
                    <Link
                      href="/routine"
                      className="flex h-6 items-center text-[18px] font-bold tabular-nums text-neutral-900"
                      aria-label={`${node.hour}시 일과 보기`}
                    >
                      {node.hour}시
                    </Link>
                    <div className="relative z-[1] flex h-6 items-center justify-center">
                      <span className="h-3.5 w-3.5 rounded-full bg-[#F19E36] ring-4 ring-[#FBE3C4]" aria-hidden />
                    </div>
                    {remainingText != null && (
                      <span className="mt-2 whitespace-nowrap rounded-full bg-[#FBE3C4] px-2.5 py-1 text-[15px] font-semibold tabular-nums text-[#9A5B0E]">
                        {remainingText} 남음
                      </span>
                    )}
                  </div>
                );
              }
              if (node.kind === "empty") {
                return (
                  <div key={node.key} ref={node.isEnd ? currentEndRef : undefined} className="flex shrink-0 flex-col items-center px-3 opacity-80 md:px-5">
                    <Link
                      href="/routine"
                      className="flex h-6 items-center text-[17px] font-medium tabular-nums text-neutral-400"
                      aria-label={`${node.hour}시 일과 보기`}
                    >
                      {node.hour}시
                    </Link>
                    <div className="relative z-[1] flex h-6 items-center justify-center">
                      <span className="h-3 w-3 rounded-full border-[1.5px] border-neutral-200 bg-white" aria-hidden />
                    </div>
                    <span className="mt-1.5 whitespace-nowrap text-[17px] text-neutral-300">할 일 없음</span>
                  </div>
                );
              }
              const checked = completedIds.includes(node.item.id);
              return (
                <div key={node.key} ref={node.isEnd ? currentEndRef : undefined} className="flex shrink-0 flex-col items-center px-3 md:px-5">
                  {node.hour != null ? (
                    <Link
                      href="/routine"
                      className="flex h-6 items-center text-[17px] font-medium tabular-nums text-neutral-500"
                      aria-label={`${node.hour}시 일과 보기`}
                    >
                      {node.hour}시
                    </Link>
                  ) : (
                    <span className="h-6" aria-hidden />
                  )}
                  <button
                    type="button"
                    onClick={() => onToggle(node.item.id)}
                    className="relative z-[1] flex h-6 items-center justify-center"
                    aria-label={checked ? `${node.item.text || "항목"} 완료 해제` : `${node.item.text || "항목"} 완료`}
                  >
                    <span
                      className={`flex h-3 w-3 items-center justify-center rounded-full border-[1.5px] ${
                        checked ? "border-neutral-300 bg-neutral-300" : "border-neutral-300 bg-white"
                      }`}
                      aria-hidden
                    />
                  </button>
                  {/* 글자를 눌러도 동그라미처럼 완료 표시 */}
                  <button
                    type="button"
                    onClick={() => onToggle(node.item.id)}
                    className={`mt-2 whitespace-nowrap text-[17px] ${
                      checked
                        ? "text-neutral-300 line-through"
                        : node.tone === "current"
                          ? "font-semibold text-neutral-800"
                          : "text-neutral-500"
                    }`}
                    aria-label={checked ? `${node.item.text || "항목"} 완료 해제` : `${node.item.text || "항목"} 완료`}
                  >
                    {node.item.text || "항목"}
                  </button>
                </div>
              );
            })}
            <span className="shrink-0" style={{ width: sidePad }} aria-hidden />
          </div>
        </div>
        {/* 양 끝을 흐리게 → 옆에 더 있다는 표시. 폰은 좁게 해서 다음 시간대가 살짝 비치게 */}
        <span className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-6 bg-gradient-to-r from-white via-white/80 to-transparent md:w-24" aria-hidden />
        <span className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-6 bg-gradient-to-l from-white via-white/80 to-transparent md:w-24" aria-hidden />
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
