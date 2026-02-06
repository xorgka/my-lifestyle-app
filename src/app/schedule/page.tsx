"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

type ViewMode = "today" | "week" | "month";

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
      ? `${base} text-slate-500 group-hover:text-slate-200`
      : `${base} text-slate-500`;
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
    return "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100" + hover;
  return opts?.calendar
    ? "border-neutral-200/70 bg-neutral-50 text-neutral-700 hover:bg-neutral-200" + hover
    : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100";
}

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export default function SchedulePage() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("today");
  const [addOpen, setAddOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth() + 1);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [weekStartDateStr, setWeekStartDateStr] = useState(() => startOfWeek(new Date()));
  const [weekItemModal, setWeekItemModal] = useState<ScheduleItem & { dateStr: string } | null>(null);
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);
  const [builtinDeletedVersion, setBuiltinDeletedVersion] = useState(0);

  const range = useMemo(
    () => getRange(viewMode, calendarYear, calendarMonth, weekStartDateStr),
    [viewMode, calendarYear, calendarMonth, weekStartDateStr]
  );
  const items = useMemo(
    () => getScheduleItemsInRange(range.start, range.end, entries, builtinDeletedVersion),
    [range, entries, builtinDeletedVersion]
  );

  const itemsByDate = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {};
    for (const item of items) {
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    }
    return map;
  }, [items]);

  const refresh = useCallback(() => {
    loadScheduleEntries().then(setEntries);
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
      createdAt: "",
    };
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <SectionTitle
        title="스케줄"
        subtitle="공휴일과 반복 일정을 한곳에서 확인하세요."
        className="!mb-4 md:!mb-6"
      />

      <div className="flex flex-wrap items-center gap-3">
        {(
          [
            { mode: "today" as ViewMode, label: "오늘" },
            { mode: "week" as ViewMode, label: "이번 주" },
            { mode: "month" as ViewMode, label: "이번 달" },
          ] as const
        ).map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
            setViewMode(mode);
            if (mode === "month") {
              const now = new Date();
              setCalendarYear(now.getFullYear());
              setCalendarMonth(now.getMonth() + 1);
            }
            if (mode === "week") {
              setWeekStartDateStr(startOfWeek(new Date()));
            }
          }}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
              viewMode === mode
                ? "bg-neutral-900 text-white shadow-sm"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-2xl font-semibold text-white shadow-sm hover:bg-amber-600 md:h-auto md:w-auto md:px-4 md:py-2 md:text-sm"
          title="스케줄 추가"
          aria-label="스케줄 추가"
        >
          <span>+</span>
          <span className="hidden md:inline md:ml-1">스케줄 추가</span>
        </button>
      </div>

      {loading && (
        <p className="text-sm text-neutral-500">스케줄 불러오는 중…</p>
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
            const dayItems = itemsByDate[dateStr] ?? [];
            if (dayItems.length === 0) return null;
            return (
              <Card
                key={dateStr}
                className={`min-w-0 ${isTomorrow ? "opacity-45" : "shadow-[0_10px_30px_rgba(0,0,0,0.07)]"}`}
              >
                <h3 className="mb-3 flex items-baseline gap-2 text-base font-semibold text-neutral-800">
                  <span>{dateStr === range.start ? "오늘" : "내일"}</span>
                  <span className="text-sm font-normal text-neutral-500 opacity-60">
                    {formatDateOnly(dateStr)}
                  </span>
                </h3>
                <ul className="space-y-2">
                  {dayItems.map((item, idx) => (
                    <li
                      key={item.type === "user" ? item.entryId! : `${dateStr}-${item.title}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200/70 bg-neutral-50 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-neutral-800">{item.title}</span>
                        {getSystemCategoryLabel(item) && (
                          <span className={`ml-2 ${getSystemCategoryClass(item)}`}>
                            {getSystemCategoryLabel(item)}
                          </span>
                        )}
                      </div>
                      {((item.type === "user" && item.entryId) || (item.type === "builtin" && item.builtinId)) && (
                        <div className="flex gap-1">
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
                            className="rounded-lg px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-200"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete((item.entryId ?? item.builtinId)!)}
                            className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
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
                        className="group flex flex-row items-center justify-between gap-2 rounded-lg border border-neutral-200/60 bg-white px-2.5 py-2 text-[14px] cursor-pointer transition hover:bg-neutral-900 hover:border-neutral-700"
                        title={item.title}
                      >
                        <span className="min-w-0 flex-1 truncate font-medium text-neutral-800 group-hover:text-white" title={item.title}>
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

      {weekItemModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center bg-black/50 p-4"
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
              <h3 className="text-lg font-semibold text-neutral-900">{weekItemModal.title}</h3>
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
            className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center bg-black/50 p-4"
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
        <Card className="min-w-0 hover:translate-y-0 hover:shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                if (calendarMonth <= 1) {
                  setCalendarMonth(12);
                  setCalendarYear(calendarYear - 1);
                } else setCalendarMonth(calendarMonth - 1);
              }}
              className="rounded-xl px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
            >
              <span aria-hidden>←</span><span className="hidden md:inline md:ml-0.5">이전 달</span>
            </button>
            <button
              type="button"
              onClick={() => setMonthPickerOpen((o) => !o)}
              className="rounded-xl px-4 py-2 text-xl font-semibold text-neutral-800 hover:bg-neutral-100"
            >
              {calendarYear}년 {calendarMonth}월
            </button>
            <button
              type="button"
              onClick={() => {
                if (calendarMonth >= 12) {
                  setCalendarMonth(1);
                  setCalendarYear(calendarYear + 1);
                } else setCalendarMonth(calendarMonth + 1);
              }}
              className="rounded-xl px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
            >
              <span className="hidden md:inline md:mr-0.5">다음 달</span><span aria-hidden>→</span>
            </button>
          </div>
          {monthPickerOpen && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <span className="w-full text-xs text-neutral-500">연도</span>
              <select
                value={calendarYear}
                onChange={(e) => setCalendarYear(Number(e.target.value))}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              >
                {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <span className="w-full text-xs text-neutral-500 mt-2">월</span>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setCalendarMonth(m);
                      setMonthPickerOpen(false);
                    }}
                    className={`rounded-xl px-3 py-2 text-sm font-medium ${
                      calendarMonth === m ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    {m}월
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-7 gap-px rounded-xl border border-neutral-200/80 bg-neutral-200/80 overflow-hidden">
            {WEEKDAY_NAMES.map((w, i) => (
              <div
                key={w}
                className={`bg-neutral-700 py-2 text-center text-xs font-semibold md:py-2.5 md:text-base ${
                  i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-white"
                }`}
              >
                {w}
              </div>
            ))}
            {getCalendarCells(calendarYear, calendarMonth).map((cell, idx) => {
              const isHoliday = getHolidaysOn(cell.dateStr).length > 0;
              return (
                <div
                  key={idx}
                  className={`flex min-h-[72px] flex-col overflow-hidden p-1.5 md:min-h-[80px] md:overflow-y-auto md:p-2 ${
                    cell.isCurrentMonth ? "bg-white" : "bg-neutral-50"
                  }`}
                >
                  <span
                    className={`text-xs font-medium md:text-sm ${
                      cell.isCurrentMonth
                        ? isHoliday
                          ? "text-red-600"
                          : "text-neutral-800"
                        : "text-neutral-400"
                    }`}
                  >
                    {cell.dayNum}
                  </span>
                  {/* 모바일: 개수만 표시, 클릭 시 해당 날짜 스케줄 모달 */}
                  {(itemsByDate[cell.dateStr] ?? []).length > 0 ? (
                    <div className="mt-1.5 flex flex-1 items-center justify-center md:hidden">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setDayModalDate(cell.dateStr)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDayModalDate(cell.dateStr);
                          }
                        }}
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700"
                      >
                        {(itemsByDate[cell.dateStr] ?? []).length}
                      </div>
                    </div>
                  ) : null}
                  {/* 데스크톱: 스케줄 목록 */}
                  <ul className="mt-1.5 hidden space-y-1 md:block">
                    {(itemsByDate[cell.dateStr] ?? []).map((item, i) => (
                      <li
                        key={item.type === "user" ? item.entryId! : `${cell.dateStr}-${item.title}-${i}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setWeekItemModal({ ...item, dateStr: cell.dateStr })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setWeekItemModal({ ...item, dateStr: cell.dateStr });
                          }
                        }}
                        className={`cursor-pointer truncate rounded border px-2 py-1 text-sm transition ${getSystemCategoryCardClass(item, { calendar: true })}`}
                        title={item.title}
                      >
                        {item.title}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
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
            modalTitle="스케줄 수정"
            initial={editingEntry}
          />,
          document.body
        )}
    </div>
  );
}

type FormPayload = {
  title: string;
  scheduleType: ScheduleType;
  onceDate: string | null;
  monthlyDay: number | null;
  yearlyMonth: number | null;
  yearlyDay: number | null;
  weeklyDay: number | null;
};

function ScheduleFormModal({
  onClose,
  onSubmit,
  modalTitle,
  initial,
}: {
  onClose: () => void;
  onSubmit: (p: FormPayload) => Promise<void>;
  modalTitle: string;
  initial?: ScheduleEntry;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [scheduleType, setScheduleType] = useState<ScheduleType>(
    initial?.scheduleType ?? "once"
  );
  const [onceDate, setOnceDate] = useState(
    initial?.onceDate ?? todayStr()
  );
  const [monthlyDay, setMonthlyDay] = useState(initial?.monthlyDay ?? 15);
  const [yearlyMonth, setYearlyMonth] = useState(initial?.yearlyMonth ?? 1);
  const [yearlyDay, setYearlyDay] = useState(initial?.yearlyDay ?? 1);
  const [weeklyDay, setWeeklyDay] = useState(initial?.weeklyDay ?? 1);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        scheduleType,
        onceDate: scheduleType === "once" ? onceDate : null,
        monthlyDay: scheduleType === "monthly" ? monthlyDay : null,
        yearlyMonth: scheduleType === "yearly" ? yearlyMonth : null,
        yearlyDay: scheduleType === "yearly" ? yearlyDay : null,
        weeklyDay: scheduleType === "weekly" ? weeklyDay : null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center bg-black/75 p-4"
      style={{ left: 0, top: 0, right: 0, bottom: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={modalTitle}
    >
      <div
        className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-neutral-900">{modalTitle}</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-600">
              제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-neutral-400 focus:outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-600">
              반복
            </label>
            <select
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-neutral-400 focus:outline-none"
            >
              <option value="once">한 번만</option>
              <option value="monthly">매월 N일</option>
              <option value="yearly">매년 M월 D일</option>
              <option value="weekly">매주 요일</option>
            </select>
          </div>
          {scheduleType === "once" && (
            <div>
              <label className="block text-sm font-medium text-neutral-600">
                날짜
              </label>
              <input
                type="date"
                value={onceDate}
                onChange={(e) => setOnceDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-neutral-400 focus:outline-none"
              />
            </div>
          )}
          {scheduleType === "monthly" && (
            <div>
              <label className="block text-sm font-medium text-neutral-600">
                매월 몇 일
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={monthlyDay}
                onChange={(e) => setMonthlyDay(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-neutral-400 focus:outline-none"
              />
            </div>
          )}
          {scheduleType === "yearly" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-600">
                  월
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={yearlyMonth}
                  onChange={(e) =>
                    setYearlyMonth(Math.min(12, Math.max(1, Number(e.target.value) || 1)))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-neutral-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-600">
                  일
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={yearlyDay}
                  onChange={(e) =>
                    setYearlyDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-neutral-400 focus:outline-none"
                />
              </div>
            </div>
          )}
          {scheduleType === "weekly" && (
            <div>
              <label className="block text-sm font-medium text-neutral-600">
                요일
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {WEEKDAY_NAMES.map((name, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setWeeklyDay(i)}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                      weeklyDay === i
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
