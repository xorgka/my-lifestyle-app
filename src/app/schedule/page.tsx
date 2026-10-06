"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Card } from "@/components/ui/Card";
import {
  loadScheduleEntries,
  getScheduleItemsInRange,
  addScheduleEntry,
  updateScheduleEntry,
  deleteScheduleEntry,
  deleteBuiltin,
  loadScheduleCompletions,
  saveScheduleCompletions,
  getScheduleCompletionKey,
  loadScheduleOrder,
  saveScheduleOrder,
  getScheduleItemOrderKey,
  formatScheduleTime,
  type ScheduleEntry,
  type ScheduleItem,
  type ScheduleType,
} from "@/lib/scheduleDb";
import {
  todayStr,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  localDateStr,
  addDays,
  getWeekDateStrings,
  getWeekDateStringsFromMonday,
  getCalendarCells,
} from "@/lib/dateUtil";
import { getHolidaysOn } from "@/lib/scheduleHolidays";
import { isSupabaseConfigured } from "@/lib/supabase";
import { ScheduleFormModal, type FormPayload } from "@/components/schedule/ScheduleFormModal";
import { HomeCalendarCard } from "@/components/home/HomeCalendarCard";

type ViewMode = "today" | "week" | "month" | "search";

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const today = todayStr();
  if (dateStr === today) return "오늘";
  const yesterday = localDateStr(new Date(Date.now() - 86400000));
  if (dateStr === yesterday) return "어제";
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

/** 오늘/내일 카드용: 월·일·요일만 (예: 1월 6일 월) */
function formatDateOnly(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

function getRange(
  view: ViewMode,
  calendarYear?: number,
  calendarMonth?: number,
  weekStartDateStr?: string
): { start: string; end: string } {
  const now = new Date();
  const today = todayStr();
  if (view === "today") return { start: today, end: addDays(today, 1) };
  if (view === "search") return { start: addDays(today, -365), end: addDays(today, 730) };
  if (view === "week") {
    const start = weekStartDateStr ?? startOfWeek(now);
    return { start, end: addDays(start, 6) };
  }
  const y = calendarYear ?? now.getFullYear();
  const m = calendarMonth ?? now.getMonth() + 1;
  const ref = new Date(y, m - 1, 1);
  return { start: startOfMonth(ref), end: endOfMonth(ref) };
}

const WEEK_ORDINALS = ["첫째", "둘째", "셋째", "넷째", "다섯째", "여섯째"] as const;
function getWeekTitle(mondayDateStr: string): string {
  const d = new Date(mondayDateStr + "T12:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekNum = Math.min(6, Math.ceil(day / 7));
  return `${month}월 ${WEEK_ORDINALS[weekNum - 1] ?? "여섯째"} 주`;
}

const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  once: "특정일",
  monthly: "매월",
  yearly: "매년",
  weekly: "매주",
};

/** 일정 제목 + 선택 시간 표시용 문자열 */
function getScheduleItemDisplayTitle(item: ScheduleItem): string {
  return item.time ? `${item.time} ${item.title}` : item.title;
}

/** 시스템 등록 일정만 카테고리 표시: 공휴일, 생일, 기타. 웹에서 추가한 사용자 일정은 카테고리 없음 */
function getSystemCategoryLabel(item: ScheduleItem): string | null {
  if (item.type === "holiday") return "공휴일";
  if (item.type === "builtin" && item.builtinKind === "birthday") return "생일";
  if (item.type === "builtin" && item.builtinKind === "other") return "기타";
  return null;
}

/** 카테고리별 구분 색상 (공휴일: amber, 생일: pink, 기타: slate) */
function getSystemCategoryClass(
  item: ScheduleItem,
  opts?: { weekRow?: boolean; dayModal?: boolean }
): string {
  const base = opts?.weekRow ? "text-[14px]" : "text-xs";
  if (item.type === "holiday")
    return opts?.dayModal
      ? `${base} text-red-600`
      : opts?.weekRow
        ? `${base} text-amber-600 group-hover:text-amber-200`
        : `${base} text-amber-600`;
  if (item.type === "builtin" && item.builtinKind === "birthday")
    return opts?.weekRow
      ? `${base} text-violet-600 group-hover:text-violet-200`
      : `${base} text-violet-600`;
  if (item.type === "builtin" && item.builtinKind === "other")
    return opts?.weekRow
      ? `${base} text-slate-500/60 group-hover:text-slate-200/80`
      : `${base} text-slate-500/60`;
  return `${base} text-neutral-400`;
}

/** 카테고리별 카드 스타일 (달력·모달에서 배경/테두리 구분) */
function getSystemCategoryCardClass(item: ScheduleItem, opts?: { calendar?: boolean }): string {
  const hover = opts?.calendar ? " hover:shadow-sm" : "";
  if (item.type === "holiday")
    return "border-red-200 bg-red-50 text-red-800 hover:bg-red-100" + hover;
  if (item.type === "builtin" && item.builtinKind === "birthday")
    return "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100" + hover;
  if (item.type === "builtin" && item.builtinKind === "other")
    return "border-slate-200/50 bg-slate-50/50 text-slate-700/70 hover:bg-slate-100/60" + hover;
  if (item.type === "user" && item.important)
    return "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100" + hover;
  return opts?.calendar
    ? "border-neutral-200/70 bg-neutral-50 text-neutral-700 hover:bg-neutral-200" + hover
    : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100";
}

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

/** 사용자 지정 순서가 있으면 적용, 없으면 items 순서 유지 */
function applyScheduleOrder(
  items: ScheduleItem[],
  dateStr: string,
  order: Record<string, string[]>,
  getKey: (item: ScheduleItem, date: string) => string
): ScheduleItem[] {
  const orderList = order[dateStr];
  if (!orderList || orderList.length === 0) return items;
  const keyToIndex = new Map(orderList.map((k, i) => [k, i]));
  return [...items].sort((a, b) => {
    const ia = keyToIndex.get(getKey(a, dateStr)) ?? 9999;
    const ib = keyToIndex.get(getKey(b, dateStr)) ?? 9999;
    return ia - ib;
  });
}

export default function SchedulePage() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [addOpen, setAddOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth() + 1);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [weekStartDateStr, setWeekStartDateStr] = useState(() => startOfWeek(new Date()));
  const [weekItemModal, setWeekItemModal] = useState<ScheduleItem & { dateStr: string } | null>(null);
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);
  const [builtinDeletedVersion, setBuiltinDeletedVersion] = useState(0);
  const [completions, setCompletions] = useState<Set<string>>(new Set());
  const [scheduleOrder, setScheduleOrder] = useState<Record<string, string[]>>({});
  const [isDesktop, setIsDesktop] = useState(false);
  const [dragOrderKey, setDragOrderKey] = useState<string | null>(null);
  const [dragDateStr, setDragDateStr] = useState<string | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [dropTargetOrderKey, setDropTargetOrderKey] = useState<string | null>(null);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  // 주소에 ?view=month&y=2026&m=9 가 있으면 '이번 달' 보기로 그 달을 열기 (홈 달력 제목에서 들어올 때)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") !== "month") return;
    setViewMode("month");
    const y = Number(params.get("y"));
    const m = Number(params.get("m"));
    if (Number.isInteger(y) && y >= 2000 && y <= 2100 && Number.isInteger(m) && m >= 1 && m <= 12) {
      setCalendarYear(y);
      setCalendarMonth(m);
    }
  }, []);
  const [swipedRowKey, setSwipedRowKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [weekTooltip, setWeekTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const touchStartRef = useRef<{ x: number; rowKey: string } | null>(null);

  const range = useMemo(
    () => getRange(viewMode, calendarYear, calendarMonth, weekStartDateStr),
    [viewMode, calendarYear, calendarMonth, weekStartDateStr]
  );
  const items = useMemo(
    () => getScheduleItemsInRange(range.start, range.end, entries, builtinDeletedVersion),
    [range, entries, builtinDeletedVersion]
  );

  const searchNorm = searchQuery.trim().toLowerCase();
  const searchFilteredItems = useMemo(() => {
    if (!searchNorm) return [] as ScheduleItem[];
    return items.filter((item) => item.title.toLowerCase().includes(searchNorm));
  }, [items, searchNorm]);

  const itemsByDate = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {};
    const source = viewMode === "search" ? searchFilteredItems : items;
    for (const item of source) {
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    }
    return map;
  }, [viewMode, viewMode === "search" ? searchFilteredItems : items, items, searchFilteredItems]);

  const refresh = useCallback(() => {
    loadScheduleEntries().then(setEntries);
  }, []);

  useEffect(() => {
    loadScheduleCompletions().then(setCompletions);
  }, []);
  useEffect(() => {
    loadScheduleOrder().then(setScheduleOrder);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadScheduleEntries()
      .then((data) => {
        setEntries(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (payload: {
    title: string;
    scheduleType: ScheduleType;
    onceDate: string | null;
    monthlyDay: number | null;
    yearlyMonth: number | null;
    yearlyDay: number | null;
    weeklyDay: number | null;
    time: string | null;
    important: boolean;
  }) => {
    await addScheduleEntry(payload);
    refresh();
    setAddOpen(false);
  };

  const handleUpdate = async (
    id: string,
    payload: Partial<Omit<ScheduleEntry, "id" | "createdAt">>
  ) => {
    await updateScheduleEntry(id, payload);
    refresh();
    setEditingEntry(null);
  };

  const isBuiltinId = (id: string) =>
    id.startsWith("birthday:") || id.startsWith("once:") || id.startsWith("yearly-other:");

  const handleDelete = async (id: string) => {
    if (!confirm("이 스케줄을 삭제할까요?")) return;
    if (isBuiltinId(id)) {
      deleteBuiltin(id);
      setBuiltinDeletedVersion((v) => v + 1);
      setEditingEntry(null);
      setWeekItemModal(null);
    } else {
      await deleteScheduleEntry(id);
      refresh();
      setEditingEntry(null);
    }
  };

  /** builtin 항목을 수정 폼용 ScheduleEntry로 변환 */
  const builtinItemToEntry = (item: ScheduleItem): ScheduleEntry => {
    const d = new Date(item.date);
    return {
      id: item.builtinId!,
      title: item.title,
      scheduleType: item.scheduleType ?? "once",
      onceDate: item.scheduleType === "once" ? item.date : null,
      monthlyDay: null,
      yearlyMonth: item.scheduleType === "yearly" ? d.getMonth() + 1 : null,
      yearlyDay: item.scheduleType === "yearly" ? d.getDate() : null,
      weeklyDay: null,
      time: null,
      important: false,
      createdAt: "",
    };
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
      {/* 제목 오른쪽에 검색창 (추가는 달력의 + 버튼) */}
      <div className="mb-4 flex items-center justify-between gap-3 md:mb-6">
        <SectionTitle
          title="스케줄"
          subtitle="공휴일과 반복 일정을 한곳에서 확인하세요."
          className="!mb-0 min-w-0"
        />
        {/* 바로 입력하는 검색창: 글자가 있으면 검색 결과, 비우면 달력 */}
        <div className="relative w-40 shrink-0 sm:w-56 md:w-72">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            placeholder="스케줄 검색"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setViewMode(e.target.value.trim() ? "search" : "month");
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchQuery("");
                setViewMode("month");
              }
            }}
            className="w-full rounded-2xl border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-[15px] text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300/50"
            aria-label="스케줄 제목 검색"
          />
        </div>
      </div>

      {!isSupabaseConfigured && (
        <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">
          PC·스마트폰 연동을 위해 .env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하고 Supabase에 schedule_entries 테이블을 만들어 주세요.
        </p>
      )}

      {loading && (
        <p className="text-sm text-neutral-500">스케줄 불러오는 중…</p>
      )}

      {!loading && viewMode === "search" && !searchNorm && (
        <Card className="min-w-0">
          <p className="text-neutral-500">검색어를 입력하면 모든 스케줄에서 찾아요.</p>
        </Card>
      )}

      {!loading && viewMode === "search" && searchNorm && searchFilteredItems.length === 0 && (
        <Card className="min-w-0">
          <p className="text-neutral-500">&quot;{searchQuery.trim()}&quot; 검색 결과가 없어요.</p>
        </Card>
      )}

      {!loading && viewMode === "search" && searchNorm && searchFilteredItems.length > 0 && (
        <div className="min-w-0 space-y-4">
          {Object.keys(itemsByDate)
            .sort()
            .map((dateStr) => {
              const dayItems = itemsByDate[dateStr] ?? [];
              if (dayItems.length === 0) return null;
              return (
                <Card key={dateStr} className="min-w-0 shadow-[0_10px_30px_rgba(0,0,0,0.07)]">
                  <h3 className="mb-3 text-base font-semibold text-neutral-800">
                    {formatDateOnly(dateStr)}
                  </h3>
                  <ul className="space-y-2">
                    {dayItems.map((item, idx) => (
                      <li
                        key={item.type === "user" ? item.entryId! : `${dateStr}-${item.title}-${idx}`}
                        className="flex items-center gap-2 rounded-xl border border-neutral-200/70 bg-neutral-50 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1 text-base md:text-lg">
                          {item.time && <span className="mr-1.5 text-neutral-500">{formatScheduleTime(item.time)}</span>}
                          <span className="font-medium text-neutral-800">{item.title}</span>
                          {getSystemCategoryLabel(item) && (
                            <span className={`ml-2 ${getSystemCategoryClass(item)}`}>
                              {getSystemCategoryLabel(item)}
                            </span>
                          )}
                        </div>
                        {((item.type === "user" && item.entryId) || (item.type === "builtin" && item.builtinId)) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (item.type === "user" && item.entryId) {
                                const e = entries.find((x) => x.id === item.entryId);
                                if (e) setEditingEntry(e);
                              } else if (item.type === "builtin" && item.builtinId) {
                                setEditingEntry(builtinItemToEntry(item));
                              }
                            }}
                            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200"
                            aria-label="수정"
                            title="수정"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
        </div>
      )}

      {!loading && viewMode === "today" && items.length === 0 && (
        <Card className="min-w-0">
          <p className="text-neutral-500">오늘 예정된 스케줄이 없어요.</p>
          <p className="mt-2 text-sm text-neutral-400">
            공휴일은 자동으로 표시되고, 위 &quot;스케줄 추가&quot;로 반복 일정을 등록할 수 있어요.
          </p>
        </Card>
      )}

      {!loading && viewMode === "today" && items.length > 0 && (
        <div className="min-w-0 space-y-4">
          {[range.start, range.end].map((dateStr) => {
            const isTomorrow = dateStr !== range.start;
            const rawDayItems = itemsByDate[dateStr] ?? [];
            const dayItems = applyScheduleOrder(rawDayItems, dateStr, scheduleOrder, getScheduleItemOrderKey);
            if (dayItems.length === 0) return null;
            return (
              <Card
                key={dateStr}
                className={`min-w-0 transition-opacity transition-shadow duration-200 ${isTomorrow ? "opacity-45 hover:opacity-100 hover:shadow-[0_10px_30px_rgba(0,0,0,0.07)]" : "shadow-[0_10px_30px_rgba(0,0,0,0.07)]"}`}
              >
                <h3 className="mb-3 flex items-baseline gap-2 text-base font-semibold text-neutral-800">
                  <span>{dateStr === range.start ? "오늘" : "내일"}</span>
                  <span className="text-sm font-normal text-neutral-500 opacity-60">
                    {formatDateOnly(dateStr)}
                  </span>
                </h3>
                <ul className="space-y-2">
                  {dayItems.map((item, idx) => {
                    const orderKey = getScheduleItemOrderKey(item, dateStr);
                    const rowKey = item.type === "user" ? item.entryId! : `${dateStr}-${item.title}-${idx}`;
                    const canEdit = (item.type === "user" && item.entryId) || (item.type === "builtin" && item.builtinId);
                    const completionKey = getScheduleCompletionKey(item, dateStr);
                    const isCompleted = completionKey !== null && completions.has(completionKey);
                    const toggleComplete = () => {
                      if (completionKey === null) return;
                      const next = new Set(completions);
                      if (next.has(completionKey)) next.delete(completionKey);
                      else next.add(completionKey);
                      setCompletions(next);
                      saveScheduleCompletions(next);
                    };
                    const openEdit = () => {
                      if (item.type === "user" && item.entryId) {
                        const e = entries.find((x) => x.id === item.entryId);
                        if (e) setEditingEntry(e);
                      } else if (item.type === "builtin" && item.builtinId) {
                        setEditingEntry(builtinItemToEntry(item));
                      }
                    };
                    const isSwiped = swipedRowKey === rowKey;
                    const editButton = canEdit ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit();
                          setSwipedRowKey(null);
                        }}
                        className="absolute right-0 top-0 z-0 flex h-full w-14 items-center justify-center bg-neutral-300 text-neutral-700 md:hidden"
                        aria-label="수정"
                        title="수정"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                      </button>
                    ) : null;
                    const rowContent = (
                      <>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleComplete();
                            }}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-neutral-300 text-white transition hover:border-neutral-400 md:mr-2"
                            aria-label={isCompleted ? "완료 해제" : "완료"}
                            title={isCompleted ? "완료 해제" : "완료"}
                            style={isCompleted ? { backgroundColor: "#000", borderColor: "#000" } : undefined}
                          >
                            {isCompleted && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            )}
                          </button>
                        ) : (
                          <span className="w-5 shrink-0 md:mr-2" aria-hidden />
                        )}
                        <div className="min-w-0 flex-1 text-base md:text-lg">
                          {item.time && <span className="mr-1.5 text-neutral-500">{formatScheduleTime(item.time)}</span>}
                          <span className={`font-medium text-neutral-800 ${isCompleted ? "line-through opacity-60" : ""}`}>
                            {item.title}
                          </span>
                          {getSystemCategoryLabel(item) && (
                            <span className={`ml-2 ${getSystemCategoryClass(item)}`}>
                              {getSystemCategoryLabel(item)}
                            </span>
                          )}
                        </div>
                      </>
                    );
                    const isDropTarget = isDesktop && dropTargetDate === dateStr && dropTargetOrderKey === orderKey;
                    return (
                      <li
                        key={rowKey}
                        className={`relative rounded-xl border overflow-hidden bg-neutral-50 ${isDropTarget ? "border-neutral-400 ring-2 ring-neutral-300" : "border-neutral-200/70"}`}
                        onDragOver={isDesktop ? (e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDropTargetDate(dateStr);
                          setDropTargetOrderKey(orderKey);
                        } : undefined}
                        onDragLeave={isDesktop ? () => {
                          if (dropTargetOrderKey === orderKey) setDropTargetOrderKey(null);
                        } : undefined}
                        onDrop={isDesktop ? (e) => {
                          e.preventDefault();
                          const fromDate = e.dataTransfer.getData("text/plain").split("|")[0];
                          const fromKey = e.dataTransfer.getData("text/plain").split("|")[1];
                          if (fromDate !== dateStr || !fromKey) {
                            setDragOrderKey(null);
                            setDragDateStr(null);
                            setDropTargetDate(null);
                            setDropTargetOrderKey(null);
                            return;
                          }
                          const keys = dayItems.map((i) => getScheduleItemOrderKey(i, dateStr));
                          const fromIdx = keys.indexOf(fromKey);
                          const toIdx = keys.indexOf(dropTargetOrderKey ?? fromKey);
                          if (fromIdx === -1 || toIdx === -1) {
                            setDragOrderKey(null);
                            setDragDateStr(null);
                            setDropTargetDate(null);
                            setDropTargetOrderKey(null);
                            return;
                          }
                          const newKeys = keys.filter((_, i) => i !== fromIdx);
                          const insertAt = fromIdx < toIdx ? toIdx - 1 : toIdx;
                          newKeys.splice(insertAt, 0, fromKey);
                          const next = { ...scheduleOrder, [dateStr]: newKeys };
                          setScheduleOrder(next);
                          saveScheduleOrder(next);
                          setDragOrderKey(null);
                          setDragDateStr(null);
                          setDropTargetDate(null);
                          setDropTargetOrderKey(null);
                        } : undefined}
                        onDragEnd={isDesktop ? () => {
                          setDragOrderKey(null);
                          setDragDateStr(null);
                          setDropTargetDate(null);
                          setDropTargetOrderKey(null);
                        } : undefined}
                      >
                        <div
                          className="relative overflow-hidden select-none"
                          style={{ touchAction: "pan-y" }}
                          onTouchStart={canEdit ? (e) => {
                            const touch = e.touches[0];
                            if (touch) touchStartRef.current = { x: touch.clientX, rowKey };
                          } : undefined}
                          onTouchMove={canEdit ? (e) => {
                            const start = touchStartRef.current;
                            if (!start || start.rowKey !== rowKey) return;
                            const touch = e.touches[0];
                            if (!touch) return;
                            const delta = start.x - touch.clientX;
                            if (delta > 30) e.preventDefault();
                          } : undefined}
                          onTouchEnd={canEdit ? (e) => {
                            const start = touchStartRef.current;
                            touchStartRef.current = null;
                            if (!start || start.rowKey !== rowKey) return;
                            const endX = e.changedTouches[0]?.clientX ?? start.x;
                            const delta = start.x - endX;
                            if (delta > 40) setSwipedRowKey(rowKey);
                            else if (delta < -25) setSwipedRowKey(null);
                          } : undefined}
                          onTouchCancel={() => {
                            touchStartRef.current = null;
                          }}
                        >
                          {editButton}
                          <div
                            className="relative z-10 flex min-h-[52px] items-center gap-2 bg-neutral-50 px-4 py-3 transition-transform duration-200 ease-out md:!translate-x-0"
                            style={isSwiped ? { transform: "translateX(-56px)" } : undefined}
                            onDoubleClick={() => {
                              if (canEdit) {
                                setSwipedRowKey(null);
                                openEdit();
                              }
                            }}
                          >
                            {rowContent}
                            {isDesktop && (
                              <div
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData("text/plain", `${dateStr}|${orderKey}`);
                                  e.dataTransfer.effectAllowed = "move";
                                  setDragOrderKey(orderKey);
                                  setDragDateStr(dateStr);
                                }}
                                className="ml-auto hidden shrink-0 cursor-grab touch-none items-center justify-center rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 active:cursor-grabbing md:flex"
                                aria-label="순서 변경 드래그"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                  <circle cx="9" cy="6" r="1.5" />
                                  <circle cx="9" cy="12" r="1.5" />
                                  <circle cx="9" cy="18" r="1.5" />
                                  <circle cx="15" cy="6" r="1.5" />
                                  <circle cx="15" cy="12" r="1.5" />
                                  <circle cx="15" cy="18" r="1.5" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && viewMode === "week" && (
        <Card className="min-w-0 hover:translate-y-0 hover:shadow-sm md:overflow-x-auto">
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setWeekStartDateStr((s) => addDays(s, -7))}
              className="rounded-xl px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
            >
              <span aria-hidden>←</span><span className="hidden md:inline md:ml-0.5">이전 주</span>
            </button>
            <h3 className="text-lg font-semibold text-neutral-800">
              {getWeekTitle(weekStartDateStr)}
            </h3>
            <button
              type="button"
              onClick={() => setWeekStartDateStr((s) => addDays(s, 7))}
              className="rounded-xl px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
            >
              <span className="hidden md:inline md:mr-0.5">다음 주</span><span aria-hidden>→</span>
            </button>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 md:min-w-[min(100%,700px)] md:grid-cols-7">
            {getWeekDateStringsFromMonday(weekStartDateStr).map((dateStr) => {
              const d = new Date(dateStr + "T12:00:00");
              const dayOfWeek = d.getDay();
              const label = `${d.getMonth() + 1}/${d.getDate()} ${WEEKDAY_NAMES[dayOfWeek]}`;
              const list = itemsByDate[dateStr] ?? [];
              const isHoliday = getHolidaysOn(dateStr).length > 0;
              const isToday = dateStr === todayStr();
              const dateLabelColor =
                dayOfWeek === 0 ? "text-red-400" : dayOfWeek === 6 ? "text-blue-400" : isHoliday ? "text-red-600" : "text-neutral-700";
              return (
                <div
                  key={dateStr}
                  className={`min-w-0 flex flex-row rounded-xl overflow-hidden transition hover:bg-neutral-100/80 hover:shadow-md md:flex-col ${
                    isToday
                      ? "border-2 border-neutral-900 bg-neutral-50/80"
                      : "border border-neutral-200/70 bg-neutral-50/80"
                  }`}
                >
                  <div
                    className={`w-16 shrink-0 border-r border-b-0 border-neutral-200/80 bg-neutral-100/80 py-2 px-1 text-center text-xs font-semibold md:w-full md:border-r-0 md:border-b md:px-2 md:py-3 md:text-sm ${dateLabelColor}`}
                  >
                    {label}
                  </div>
                  <ul className="min-w-0 flex-1 space-y-1.5 bg-white/60 p-2 min-h-[52px] md:min-h-[60px]">
                    {list.map((item, idx) => (
                      <li
                        key={item.type === "user" ? item.entryId! : `${dateStr}-${item.title}-${idx}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setWeekItemModal({ ...item, dateStr })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setWeekItemModal({ ...item, dateStr });
                          }
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setWeekTooltip({
                            text: getScheduleItemDisplayTitle(item),
                            x: rect.right + 8,
                            y: rect.top + rect.height / 2,
                          });
                        }}
                        onMouseLeave={() => setWeekTooltip(null)}
                        className={`group flex flex-row items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-[14px] cursor-pointer transition ${getSystemCategoryCardClass(item)}`}
                      >
                        <span className="min-w-0 flex-1 truncate font-medium [color:inherit]">
                          {item.time && <span className="mr-1.5 text-neutral-500">{formatScheduleTime(item.time)}</span>}
                          {item.title}
                        </span>
                        <span className="flex-shrink-0 md:hidden">
                          {getSystemCategoryLabel(item) && (
                            <span className={getSystemCategoryClass(item, { weekRow: true })}>
                              {getSystemCategoryLabel(item)}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {weekTooltip &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[200] -translate-y-1/2 whitespace-nowrap rounded-xl bg-neutral-800 px-4 py-3 text-base font-medium text-white shadow-xl"
            style={{ left: weekTooltip.x, top: weekTooltip.y }}
            role="tooltip"
          >
            {weekTooltip.text}
          </div>,
          document.body
        )}

      {weekItemModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center bg-black/65 p-4"
            style={{ left: 0, top: 0, right: 0, bottom: 0 }}
            onClick={() => setWeekItemModal(null)}
            role="dialog"
            aria-modal="true"
            aria-label="스케줄 상세"
          >
            <div
              className="mx-auto w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-neutral-900">
                {weekItemModal.time && <span className="mr-1.5 text-neutral-500">{weekItemModal.time}</span>}
                {weekItemModal.title}
              </h3>
              <p className="mt-2 text-sm text-neutral-500">
                {formatDisplayDate(weekItemModal.dateStr)}
              </p>
              {getSystemCategoryLabel(weekItemModal) && (
                <span className={`mt-1 inline-block ${getSystemCategoryClass(weekItemModal)}`}>
                  {getSystemCategoryLabel(weekItemModal)}
                </span>
              )}
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => setWeekItemModal(null)}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
                >
                  닫기
                </button>
                {((weekItemModal.type === "user" && weekItemModal.entryId) || (weekItemModal.type === "builtin" && weekItemModal.builtinId)) && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (weekItemModal.type === "user" && weekItemModal.entryId) {
                          const e = entries.find((x) => x.id === weekItemModal.entryId);
                          if (e) setEditingEntry(e);
                        } else if (weekItemModal.type === "builtin" && weekItemModal.builtinId) {
                          setEditingEntry(builtinItemToEntry(weekItemModal));
                        }
                        setWeekItemModal(null);
                      }}
                      className="flex-1 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const id = (weekItemModal.entryId ?? weekItemModal.builtinId)!;
                        setWeekItemModal(null);
                        handleDelete(id);
                      }}
                      className="rounded-xl px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {dayModalDate &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center bg-black/65 p-4"
            style={{ left: 0, top: 0, right: 0, bottom: 0 }}
            onClick={() => setDayModalDate(null)}
            role="dialog"
            aria-modal="true"
            aria-label="해당 날짜 스케줄"
          >
            <div
              className="mx-auto w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl max-h-[70vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-neutral-900">
                {formatDisplayDate(dayModalDate)}
              </h3>
              <ul className="mt-4 flex-1 overflow-y-auto space-y-2">
                {(itemsByDate[dayModalDate] ?? []).map((item, i) => (
                  <li
                    key={item.type === "user" ? item.entryId! : `${dayModalDate}-${item.title}-${i}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setWeekItemModal({ ...item, dateStr: dayModalDate });
                      setDayModalDate(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setWeekItemModal({ ...item, dateStr: dayModalDate });
                        setDayModalDate(null);
                      }
                    }}
                    className={`cursor-pointer rounded-xl border px-4 py-3 text-sm transition ${getSystemCategoryCardClass(item)}`}
                  >
                    {item.time && <span className="mr-1.5 text-neutral-500">{formatScheduleTime(item.time)}</span>}
                    {item.title}
                    {getSystemCategoryLabel(item) && (
                      <span className={`ml-2 ${getSystemCategoryClass(item, { dayModal: true })}`}>
                        {getSystemCategoryLabel(item)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setDayModalDate(null)}
                className="mt-4 w-full rounded-xl bg-neutral-100 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-200"
              >
                닫기
              </button>
            </div>
          </div>,
          document.body
        )}

      {!loading && viewMode === "month" && (
        <HomeCalendarCard
          key={`${calendarYear}-${calendarMonth}`}
          className="md:h-[760px]"
          initialYear={calendarYear}
          initialMonth={calendarMonth}
          entries={entries}
          builtinVersion={builtinDeletedVersion}
          onItemClick={(item, dateStr) => setWeekItemModal({ ...item, dateStr })}
          onAddClick={() => setAddOpen(true)}
          linkTitle={false}
          maxItemsPerCell={4}
        />
      )}

{addOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <ScheduleFormModal
            onClose={() => setAddOpen(false)}
            onSubmit={handleAdd}
            modalTitle="스케줄 추가"
          />,
          document.body
        )}
      {editingEntry &&
        createPortal(
          <ScheduleFormModal
            onClose={() => setEditingEntry(null)}
            onSubmit={async (payload) => {
              if (isBuiltinId(editingEntry.id)) {
                deleteBuiltin(editingEntry.id);
                await addScheduleEntry(payload);
                setBuiltinDeletedVersion((v) => v + 1);
                refresh();
                setEditingEntry(null);
              } else {
                await handleUpdate(editingEntry.id, payload);
              }
            }}
            onDelete={
              editingEntry
                ? async () => {
                    await handleDelete(editingEntry.id);
                  }
                : undefined
            }
            modalTitle="스케줄 수정"
            initial={editingEntry}
          />,
          document.body
        )}
    </div>
  );
}
