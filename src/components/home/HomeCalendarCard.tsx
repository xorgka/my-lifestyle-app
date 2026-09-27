"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  loadScheduleEntries,
  getScheduleItemsInRange,
  addScheduleEntry,
  formatScheduleTime,
  type ScheduleEntry,
  type ScheduleItem,
} from "@/lib/scheduleDb";
import { ScheduleFormModal } from "@/components/schedule/ScheduleFormModal";
import { localDateStr, todayStr } from "@/lib/dateUtil";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
/** 일정이 이 개수를 넘으면 (개수-1)개만 보이고 나머지는 +N */
const MAX_ITEMS_PER_CELL = 2;

/** 해당 월을 채우는 달력 셀 (일~토, 필요한 주 수만큼) */
function buildCells(year: number, month: number) {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const rows = Math.ceil((firstDow + daysInMonth) / 7);
  const cells = Array.from({ length: rows * 7 }, (_, i) => {
    const d = new Date(year, month - 1, 1 - firstDow + i);
    return {
      dateStr: localDateStr(d),
      dayNum: d.getDate(),
      isCurrentMonth: d.getMonth() === month - 1,
    };
  });
  return { cells, rows };
}

function chipClass(item: ScheduleItem): string {
  if (item.type === "holiday") return "bg-red-50 text-red-700";
  if (item.type === "builtin" && item.builtinKind === "birthday") return "bg-violet-50 text-violet-700";
  if (item.type === "builtin") return "bg-slate-100 text-slate-600";
  if (item.important) return "bg-amber-100 text-amber-800";
  return "bg-neutral-100 text-neutral-700";
}

function dotClass(item: ScheduleItem): string {
  if (item.type === "holiday") return "bg-red-400";
  if (item.type === "builtin" && item.builtinKind === "birthday") return "bg-violet-400";
  if (item.type === "builtin") return "bg-slate-400";
  if (item.important) return "bg-amber-500";
  return "bg-neutral-500";
}

/** 홈용 월간 달력: 날짜별 일정을 한눈에. 칸을 누르면 스케줄 페이지로 이동 */
export function HomeCalendarCard({ className = "" }: { className?: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  /** 일정 목록 모달로 보고 있는 날짜 (YYYY-MM-DD) */
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);
  /** 스케줄 추가 폼 모달 */
  const [addOpen, setAddOpen] = useState(false);
  /** 모바일: 누른 날짜의 일정을 달력 아래에 펼쳐 보여줌 */
  const [selectedDate, setSelectedDate] = useState(() => todayStr());

  useEffect(() => {
    if (!dayModalDate) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDayModalDate(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dayModalDate]);

  const refresh = useCallback(() => {
    loadScheduleEntries().then(setEntries).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  const { cells, rows } = useMemo(() => buildCells(year, month), [year, month]);

  const itemsByDate = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {};
    const items = getScheduleItemsInRange(cells[0].dateStr, cells[cells.length - 1].dateStr, entries, 0);
    for (const item of items) (map[item.date] ??= []).push(item);
    Object.values(map).forEach((list) =>
      list.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"))
    );
    return map;
  }, [cells, entries]);

  const selectedItems = useMemo(() => {
    const list = getScheduleItemsInRange(selectedDate, selectedDate, entries, 0);
    return list.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  }, [selectedDate, entries]);

  /** 데스크톱은 일정 있는 날짜에 모달, 모바일은 아래 목록 선택 */
  const handleCellClick = (dateStr: string, hasItems: boolean) => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      if (hasItems) setDayModalDate(dateStr);
      return;
    }
    setSelectedDate(dateStr);
  };

  const today = todayStr();
  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };
  const goToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setSelectedDate(todayStr());
  };

  const navButton =
    "flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800";

  return (
    <div
      className={`flex min-h-0 min-w-0 flex-col rounded-3xl border border-neutral-300 bg-white p-4 shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_2px_4px_rgba(0,0,0,0.02),0_6px_12px_rgba(0,0,0,0.05),0_10px_24px_rgba(0,0,0,0.04)] md:p-5 ${className}`}
    >
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shiftMonth(-1)} className={navButton} aria-label="이전 달">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="min-w-[6.5rem] text-center text-xl font-semibold text-neutral-800">
            {year}년 {month}월
          </span>
          <button type="button" onClick={() => shiftMonth(1)} className={navButton} aria-label="다음 달">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goToday}
            className="ml-1 rounded-full bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-600 transition hover:bg-neutral-200"
          >
            오늘
          </button>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-700"
          aria-label="스케줄 추가"
          title="스케줄 추가"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <div className="grid shrink-0 grid-cols-7 gap-px pb-1">
        {WEEKDAY_NAMES.map((w, i) => (
          <div
            key={w}
            className={`text-center text-sm font-semibold ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-neutral-500"}`}
          >
            {w}
          </div>
        ))}
      </div>

      <div
        className="grid h-[340px] flex-none grid-cols-7 gap-px overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-200/80 md:h-auto md:min-h-0 md:flex-1"
        style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      >
        {cells.map((cell) => {
          const items = itemsByDate[cell.dateStr] ?? [];
          const isToday = cell.dateStr === today;
          const hasHoliday = items.some((it) => it.type === "holiday");
          /** 시스템 일정(공휴일·생일·기타)은 날짜 숫자 오른쪽에 작게, 내 일정만 아래 목록에 */
          const systemItems = items.filter((it) => it.type !== "user");
          const userItems = items.filter((it) => it.type === "user");
          const visibleItems = userItems.length > MAX_ITEMS_PER_CELL ? userItems.slice(0, MAX_ITEMS_PER_CELL - 1) : userItems;
          const extra = userItems.length - visibleItems.length;
          return (
            <div
              key={cell.dateStr}
              role="button"
              tabIndex={0}
              onClick={() => handleCellClick(cell.dateStr, items.length > 0)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCellClick(cell.dateStr, items.length > 0);
                }
              }}
              className={`flex min-h-0 min-w-0 cursor-pointer flex-col overflow-hidden p-1 transition md:p-1 ${
                items.length > 0 ? "md:hover:bg-neutral-50" : "md:cursor-default"
              } ${
                cell.dateStr === selectedDate
                  ? cell.isCurrentMonth
                    ? "bg-neutral-200/70 md:bg-white"
                    : "bg-neutral-200/70 md:bg-neutral-50"
                  : cell.isCurrentMonth
                    ? "bg-white"
                    : "bg-neutral-50"
              } ${isToday ? "ring-2 ring-inset ring-neutral-800" : ""}`}
            >
              <div className="flex min-w-0 items-baseline justify-between gap-1">
              <span
                className={`shrink-0 text-sm font-semibold leading-tight md:text-[17px] ${
                  !cell.isCurrentMonth ? "text-neutral-300" : hasHoliday ? "text-red-600" : "text-neutral-800"
                }`}
              >
                {cell.dayNum}
              </span>
              {systemItems.length > 0 && (
                <span
                  className={`hidden min-w-0 truncate text-right text-[11px] font-semibold leading-tight md:block ${
                    systemItems[0].type === "holiday"
                      ? "text-red-500"
                      : systemItems[0].builtinKind === "birthday"
                        ? "text-violet-500"
                        : "text-slate-400"
                  } ${cell.isCurrentMonth ? "" : "opacity-50"}`}
                  title={systemItems.map((it) => it.title).join(", ")}
                >
                  {systemItems.map((it) => it.title).join("·")}
                </span>
              )}
              </div>
              {/* 모바일: 일정별 색 막대 (최대 3개) */}
              <div className="mt-1 flex flex-col gap-0.5 md:hidden">
                {items.slice(0, 3).map((item, i) => (
                  <span key={i} className={`h-1 w-full rounded-full ${dotClass(item)}`} />
                ))}
              </div>
              {/* 데스크톱: 일정 제목 */}
              <ul className="mt-0.5 hidden min-h-0 flex-1 space-y-0.5 overflow-hidden md:block">
                {visibleItems.map((item, i) => (
                  <li
                    key={i}
                    className={`truncate rounded px-1 py-0 text-[15px] md:max-xl:text-[14px] font-semibold leading-tight ${chipClass(item)} ${cell.isCurrentMonth ? "" : "opacity-50"}`}
                    title={item.time ? `${item.time} ${item.title}` : item.title}
                  >
                    {item.time && <span className="mr-1 font-medium text-neutral-400">{formatScheduleTime(item.time)}</span>}
                    {item.title}
                  </li>
                ))}
                {extra > 0 && <li className="px-1 text-[15px] md:max-xl:text-[14px] font-semibold text-neutral-400">+{extra}</li>}
              </ul>
            </div>
          );
        })}
      </div>

      {/* 모바일: 선택한 날짜의 일정 목록 */}
      <div className="mt-3 md:hidden">
        <div className="mb-1.5 text-sm font-semibold text-neutral-800">
          {(() => {
            const d = new Date(selectedDate + "T12:00:00");
            return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_NAMES[d.getDay()]})`;
          })()}
        </div>
        {selectedItems.length === 0 ? (
          <p className="py-2 text-sm text-neutral-400">일정이 없어요</p>
        ) : (
          <ul className="space-y-1.5">
            {selectedItems.map((item, i) => (
              <li key={i} className={`rounded-xl px-3 py-2 text-[15px] font-semibold ${chipClass(item)}`}>
                {item.time && <span className="mr-2 font-medium opacity-60">{formatScheduleTime(item.time)}</span>}
                {item.title}
              </li>
            ))}
          </ul>
        )}
      </div>

      {addOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <ScheduleFormModal
            modalTitle="스케줄 추가"
            onClose={() => setAddOpen(false)}
            onSubmit={async (payload) => {
              await addScheduleEntry(payload);
              refresh();
            }}
          />,
          document.body
        )}

      {dayModalDate &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => setDayModalDate(null)}
          >
            <div
              className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-neutral-900">
                  {(() => {
                    const d = new Date(dayModalDate + "T12:00:00");
                    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_NAMES[d.getDay()]})`;
                  })()}
                </h3>
                <button
                  type="button"
                  onClick={() => setDayModalDate(null)}
                  className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                  aria-label="닫기"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <ul className="space-y-2">
                {(itemsByDate[dayModalDate] ?? []).map((item, i) => (
                  <li key={i} className={`rounded-xl px-3 py-2 text-base font-semibold ${chipClass(item)}`}>
                    {item.time && <span className="mr-2 font-medium opacity-70">{formatScheduleTime(item.time)}</span>}
                    {item.title}
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
