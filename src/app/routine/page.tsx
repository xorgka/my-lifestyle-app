"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import confetti from "canvas-confetti";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Card } from "@/components/ui/Card";
import {
  loadRoutineItems,
  saveRoutineItems,
  loadRoutineCompletions,
  saveRoutineCompletions,
} from "@/lib/routineDb";

type RoutineItem = {
  id: number;
  title: string;
};

const KEEP_DAILY_MONTHS = 12; // 이 기간만 보관, 그 이전 데이터는 자동 삭제

function getCutoffDateKey(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - KEEP_DAILY_MONTHS);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function pruneOldCompletions(data: Record<string, number[]>): Record<string, number[]> {
  const cutoff = getCutoffDateKey();
  const next: Record<string, number[]> = {};
  Object.entries(data).forEach(([key, ids]) => {
    if (key >= cutoff) next[key] = ids;
  });
  return next;
}

const defaultItems: RoutineItem[] = [
  { id: 1, title: "아침 물 한 잔" },
  { id: 2, title: "10분 스트레칭" },
  { id: 3, title: "오늘의 우선순위 3가지 적기" },
  { id: 4, title: "30분 집중 작업" },
];

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fireConfetti() {
  const count = 28;
  const defaults = { startVelocity: 28, spread: 100, scalar: 0.85, ticks: 120 };

  const fire = (x: number, delay: number) => {
    setTimeout(() => {
      confetti({ ...defaults, particleCount: count, origin: { x, y: 0.55 } });
    }, delay);
  };

  fire(0.25, 0);
  fire(0.5, 80);
  fire(0.75, 160);
}

export default function RoutinePage() {
  const [items, setItems] = useState<RoutineItem[]>(defaultItems);
  const [dailyCompletions, setDailyCompletions] = useState<Record<string, number[]>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [statsTab, setStatsTab] = useState<"주별" | "월별" | "이번달">("주별");
  /** 주별: 0 = 현재 주, -1 = 저번 주, -2 = 그저번 주 … (좌우 화살표로 이동) */
  const [weeklyOffset, setWeeklyOffset] = useState(0);
  const [monthlyRangeMode, setMonthlyRangeMode] = useState<"6months" | "1year" | "year">("6months");
  const [monthlyRangeYear, setMonthlyRangeYear] = useState<number>(() => new Date().getFullYear());
  /** 리스트 편집 모드: 켜면 드래그·수정·삭제 표시, 끄면 체크+제목만 */
  const [listEditMode, setListEditMode] = useState(false);
  /** 초기 로드 완료 후에만 저장 (다른 기기 데이터 덮어쓰기 방지) */
  const [routineLoaded, setRoutineLoaded] = useState(false);

  const todayKey = getTodayKey();
  const completedToday = useMemo(
    () => new Set(dailyCompletions[todayKey] ?? []),
    [dailyCompletions, todayKey]
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadRoutineItems(), loadRoutineCompletions()]).then(([itemsData, completionsData]) => {
      if (cancelled) return;
      setItems(itemsData.length > 0 ? itemsData : defaultItems);
      setDailyCompletions(completionsData);
      setRoutineLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!routineLoaded) return;
    saveRoutineItems(items)
      .then((updated) => {
        const same =
          updated.length === items.length &&
          updated.every((u, i) => u.id === items[i].id && u.title === items[i].title);
        if (!same) setItems(updated);
      })
      .catch(console.error);
  }, [routineLoaded, items]);

  useEffect(() => {
    if (!routineLoaded) return;
    const toSave = pruneOldCompletions(dailyCompletions);
    saveRoutineCompletions(toSave).catch(console.error);
    if (Object.keys(toSave).length < Object.keys(dailyCompletions).length) {
      setDailyCompletions(toSave);
    }
  }, [routineLoaded, dailyCompletions]);

  useEffect(() => {
    if (addOpen) {
      const t = setTimeout(() => addInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [addOpen]);

  const completedCount = useMemo(
    () => items.filter((item) => completedToday.has(item.id)).length,
    [items, completedToday]
  );
  const progress = useMemo(
    () => (items.length === 0 ? 0 : Math.round((completedCount / items.length) * 100)),
    [completedCount, items.length]
  );

  const toggleItem = useCallback(
    (id: number) => {
      if (isDragging) return;
      const isCompleted = completedToday.has(id);
      setDailyCompletions((prev) => {
        const list = prev[todayKey] ?? [];
        const next = isCompleted ? list.filter((x) => x !== id) : [...list, id];
        return { ...prev, [todayKey]: next };
      });
      if (!isCompleted) fireConfetti();
    },
    [todayKey, completedToday, isDragging]
  );

  const startEdit = (item: RoutineItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const t = editTitle.trim();
    if (!t) return;
    setItems((prev) =>
      prev.map((i) => (i.id === editingId ? { ...i, title: t } : i))
    );
    setEditingId(null);
  };

  const deleteItem = (id: number) => {
    if (typeof window !== "undefined" && !window.confirm("이 항목을 삭제할까요?")) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDailyCompletions((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = next[key].filter((x) => x !== id);
      });
      return next;
    });
    if (editingId === id) setEditingId(null);
  };

  const addItem = () => {
    const t = newTitle.trim();
    if (!t) return;
    const newId = Math.max(0, ...items.map((i) => i.id)) + 1;
    setItems((prev) => [...prev, { id: newId, title: t }]);
    setNewTitle("");
    setAddOpen(false);
  };

  const moveItem = (fromId: number, toId: number) => {
    if (fromId === toId) return;
    setItems((prev) => {
      const fromIdx = prev.findIndex((i) => i.id === fromId);
      const toIdx = prev.findIndex((i) => i.id === toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [removed] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, removed);
      return next;
    });
  };

  const onDragStart = (id: number) => {
    setDraggedId(id);
    setIsDragging(true);
  };
  const onDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    if (draggedId !== id) setDragOverId(id);
  };
  const onDragLeave = () => setDragOverId(null);
  const onDrop = (e: React.DragEvent, toId: number) => {
    e.preventDefault();
    setDragOverId(null);
    if (draggedId != null) moveItem(draggedId, toId);
    setDraggedId(null);
    setIsDragging(false);
  };
  const onDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
    setIsDragging(false);
  };

  // 주별: 날짜 범위 문자열 (1/25~2/5)
  const weekDayNames = ["월", "화", "수", "목", "금", "토", "일"];
  type WeekData = { start: Date; days: { date: Date; key: string; pct: number }[]; weekPct: number };
  const formatWeekRange = (week: WeekData) =>
    `${week.days[0].date.getMonth() + 1}/${week.days[0].date.getDate()}~${week.days[6].date.getMonth() + 1}/${week.days[6].date.getDate()}`;

  const getWeeksForMonth = useCallback(
    (year: number, month: number): WeekData[] => {
      const first = new Date(year, month - 1, 1);
      const last = new Date(year, month, 0);
      const weeks: WeekData[] = [];
      const totalItems = items.length || 1;
      let d = new Date(first);
      while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
      for (let w = 0; w < 6; w++) {
        const weekStart = new Date(d);
        const days: { date: Date; key: string; pct: number }[] = [];
        let weekCompleted = 0;
        for (let i = 0; i < 7; i++) {
          const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
          const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
          const count = (dailyCompletions[key] ?? []).length;
          const pct = Math.round((count / totalItems) * 100);
          days.push({ date: new Date(day), key, pct });
          weekCompleted += count;
        }
        const weekPct = Math.round((weekCompleted / (7 * totalItems)) * 100);
        if (days.some((x) => x.date.getMonth() === month - 1 && x.date.getFullYear() === year))
          weeks.push({ start: new Date(weekStart), days, weekPct });
        d.setDate(d.getDate() + 7);
        if (d.getFullYear() > year || (d.getFullYear() === year && d.getMonth() > month - 1)) break;
      }
      return weeks;
    },
    [dailyCompletions, items.length]
  );

  /** 해당 월요일을 시작일로 하는 한 주 치 WeekData 반환 */
  const getWeekDataForMonday = useCallback(
    (monday: Date): WeekData => {
      const totalItems = items.length || 1;
      const days: { date: Date; key: string; pct: number }[] = [];
      let weekCompleted = 0;
      for (let i = 0; i < 7; i++) {
        const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
        const count = (dailyCompletions[key] ?? []).length;
        const pct = Math.round((count / totalItems) * 100);
        days.push({ date: day, key, pct });
        weekCompleted += count;
      }
      return {
        start: new Date(monday),
        days,
        weekPct: Math.round((weekCompleted / (7 * totalItems)) * 100),
      };
    },
    [dailyCompletions, items.length]
  );

  /** 현재 주 월요일 00:00 */
  const currentWeekMonday = useMemo(() => {
    const now = new Date();
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    while (mon.getDay() !== 1) mon.setDate(mon.getDate() - 1);
    return mon;
  }, []);

  /** 주별에서 보고 있는 주 (offset 0 = 현재 주) */
  const viewingWeek = useMemo((): WeekData => {
    const viewMonday = new Date(currentWeekMonday);
    viewMonday.setDate(viewMonday.getDate() + weeklyOffset * 7);
    return getWeekDataForMonday(viewMonday);
  }, [currentWeekMonday, weeklyOffset, getWeekDataForMonday]);

  /** 오늘이 포함된 주인지 (현재 주인지) */
  const isViewingCurrentWeek = weeklyOffset === 0;

  const monthlyStatsAll = useMemo(() => {
    const byMonth: Record<string, { total: number; days: number; completed: number }> = {};
    Object.entries(dailyCompletions).forEach(([key, ids]) => {
      const month = key.slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { total: 0, days: 0, completed: 0 };
      byMonth[month].days += 1;
      byMonth[month].completed += ids.length;
      const maxPerDay = items.length;
      byMonth[month].total += maxPerDay;
    });
    return Object.entries(byMonth)
      .map(([month, v]) => ({
        month,
        label: `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`,
        rate: v.total === 0 ? 0 : Math.round((v.completed / v.total) * 100),
        completed: v.completed,
        total: v.total,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [dailyCompletions, items.length]);

  const monthlyStatsFiltered = useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth() + 1;
    if (monthlyRangeMode === "6months") {
      const cutoff = new Date(thisYear, thisMonth - 1, 1);
      cutoff.setMonth(cutoff.getMonth() - 6);
      const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;
      return monthlyStatsAll.filter((m) => m.month >= cutoffKey);
    }
    if (monthlyRangeMode === "1year") {
      const cutoff = new Date(thisYear, thisMonth - 1, 1);
      cutoff.setMonth(cutoff.getMonth() - 12);
      const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;
      return monthlyStatsAll.filter((m) => m.month >= cutoffKey);
    }
    return monthlyStatsAll.filter((m) => m.month.startsWith(String(monthlyRangeYear)));
  }, [monthlyRangeMode, monthlyRangeYear, monthlyStatsAll]);

  const yearOptions = useMemo(() => {
    const years = new Set(monthlyStatsAll.map((m) => m.month.slice(0, 4)));
    return Array.from(years)
      .map(Number)
      .sort((a, b) => b - a);
  }, [monthlyStatsAll]);

  const thisMonthCalendar = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = first.getDay();
    const daysInMonth = last.getDate();
    const totalItems = items.length || 1;
    const cells: { day: number | null; pct: number; key: string }[] = [];
    let monthCompleted = 0;
    for (let i = 0; i < startPad; i++) cells.push({ day: null, pct: 0, key: "" });
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const count = (dailyCompletions[key] ?? []).length;
      monthCompleted += count;
      cells.push({ day: d, pct: Math.round((count / totalItems) * 100), key });
    }
    while (cells.length % 7 !== 0) cells.push({ day: null, pct: 0, key: "" });
    const totalPossible = daysInMonth * totalItems;
    const totalPct = totalPossible === 0 ? 0 : Math.round((monthCompleted / totalPossible) * 100);
    return { year, month: month + 1, cells, daysInMonth, totalPct };
  }, [dailyCompletions, items.length]);

  return (
    <div className="min-w-0 space-y-6">
      <SectionTitle
        title="루틴"
        subtitle="체크할수록 폭죽처럼 터지는, 오늘의 작은 승리들."
      />

      {/* 오늘의 진행률 - 가로 배치, 100%일 때 강조 */}
      <Card
        className={`min-w-0 py-4 transition-all duration-500 ${
          progress === 100 && items.length > 0
            ? "border-2 border-red-400/80 bg-gradient-to-br from-red-400 via-red-500 to-red-600"
            : "border-2 border-neutral-200 bg-gradient-to-br from-neutral-50 to-white"
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span
              className={`text-3xl font-bold tabular-nums sm:text-4xl ${
                progress === 100 && items.length > 0
                  ? "text-white"
                  : "text-neutral-900"
              }`}
            >
              {progress}%
            </span>
            <span
              className={`text-lg ${
                progress === 100 && items.length > 0
                  ? "text-red-100 font-medium"
                  : "text-neutral-600"
              }`}
            >
              {completedCount} / {items.length} 완료
              {progress === 100 && items.length > 0 && (
                <span className="ml-1.5">🎉</span>
              )}
            </span>
          </div>
          <div className="flex flex-1 items-center gap-3 sm:max-w-md">
            <div
              className={`h-3 flex-1 min-w-0 overflow-hidden rounded-full ${
                progress === 100 && items.length > 0 ? "bg-red-300/50" : "bg-neutral-200"
              }`}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progress === 100 && items.length > 0
                    ? "bg-white"
                    : "bg-neutral-900"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 오늘의 루틴 목록 */}
      <Card className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-neutral-900">오늘의 루틴</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setListEditMode((prev) => {
                  if (prev) setEditingId(null);
                  return !prev;
                });
              }}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                listEditMode
                  ? "bg-neutral-200 text-neutral-800 hover:bg-neutral-300"
                  : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {listEditMode ? "완료" : "편집"}
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              항목 추가
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              draggable={listEditMode}
              onDragStart={() => listEditMode && onDragStart(item.id)}
              onDragOver={(e) => listEditMode && onDragOver(e, item.id)}
              onDragLeave={onDragLeave}
              onDrop={(e) => listEditMode && onDrop(e, item.id)}
              onDragEnd={onDragEnd}
              className={`flex items-center gap-2 rounded-2xl transition-all sm:gap-3 ${
                dragOverId === item.id ? "ring-2 ring-neutral-400 ring-offset-2" : ""
              } ${draggedId === item.id ? "opacity-50" : ""}`}
            >
              {/* 드래그 핸들: 편집 모드일 때만 표시 */}
              {listEditMode && (
                <div
                  className="cursor-grab touch-none shrink-0 select-none rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 active:cursor-grabbing sm:rounded-lg sm:p-2"
                  title="드래그하여 순서 변경"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z" />
                  </svg>
                </div>
              )}

              {editingId === item.id ? (
                <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-2 sm:flex-row sm:items-center sm:gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="제목"
                    className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 sm:py-2"
                  />
                  <div className="flex gap-2 sm:shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex-1 rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 sm:flex-none sm:px-2 sm:py-1.5"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="flex-1 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 sm:flex-none sm:px-2 sm:py-1.5"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-all sm:gap-3 sm:rounded-2xl sm:py-3 ${
                      completedToday.has(item.id)
                        ? "bg-neutral-900 text-white"
                        : "hover:bg-neutral-100 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]"
                    }`}
                  >
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm font-semibold sm:h-6 sm:w-6 ${
                        completedToday.has(item.id)
                          ? "border-transparent bg-white/20 text-white"
                          : "border-neutral-300 bg-white text-neutral-400"
                      }`}
                    >
                      {completedToday.has(item.id) ? "✓" : ""}
                    </div>
                    <span
                      className={`min-w-0 flex-1 break-words text-left text-[15px] font-semibold sm:text-[1.35rem] ${
                        completedToday.has(item.id) ? "text-white" : "text-neutral-900"
                      } ${completedToday.has(item.id) ? "line-through opacity-90" : ""}`}
                    >
                      {item.title}
                    </span>
                  </button>
                  {listEditMode && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(item);
                        }}
                        className="rounded-lg p-2 text-sm text-neutral-500 hover:bg-neutral-100 sm:px-2 sm:py-1.5"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItem(item.id);
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-red-600 sm:h-8 sm:w-8"
                        aria-label="삭제"
                      >
                        <span className="text-lg leading-none">×</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* 항목 추가 모달 */}
      {addOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setAddOpen(false);
            }}
          >
            <Card
              className="w-full max-w-md space-y-4"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-neutral-900">항목 추가</h3>
              <input
                ref={addInputRef}
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="제목"
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-base text-neutral-900"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="flex-1 rounded-xl border border-neutral-200 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex-1 rounded-xl bg-neutral-900 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                >
                  추가
                </button>
              </div>
            </Card>
          </div>,
          document.body
        )}

      {/* 통계 - 탭: 주별 / 월별 / 이번달 */}
      <Card className="min-w-0 space-y-4">
        <h2 className="text-xl font-semibold text-neutral-900">통계</h2>

        <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
          {(["주별", "월별", "이번달"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatsTab(tab)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                statsTab === tab
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {statsTab === "주별" && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setWeeklyOffset((o) => o - 1)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
                aria-label="이전 주"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="min-w-[10rem] text-center text-sm font-semibold text-neutral-900">
                {isViewingCurrentWeek ? "현재 주" : formatWeekRange(viewingWeek)}
              </span>
              <button
                type="button"
                onClick={() => setWeeklyOffset((o) => Math.min(0, o + 1))}
                disabled={isViewingCurrentWeek}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:border-neutral-200"
                aria-label="다음 주"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div
              className={`rounded-2xl border p-4 shadow-sm ${
                viewingWeek.weekPct === 100
                  ? "border-red-400/80 bg-gradient-to-br from-red-400 via-red-500 to-red-600"
                  : "border-neutral-200 bg-white"
              }`}
            >
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <span className={viewingWeek.weekPct === 100 ? "text-sm text-red-100" : "text-sm text-neutral-500"}>
                  {formatWeekRange(viewingWeek)}
                </span>
                <div className="text-right">
                  <span className={viewingWeek.weekPct === 100 ? "text-xs text-red-100" : "text-xs text-neutral-400"}>주간 총</span>
                  <span className={`ml-2 text-2xl font-bold tabular-nums ${viewingWeek.weekPct === 100 ? "text-white" : "text-neutral-900"}`}>
                    {viewingWeek.weekPct}%
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {weekDayNames.map((name, i) => (
                  <div
                    key={name}
                    className={`flex-1 rounded-xl py-2 text-center ${
                      viewingWeek.days[i].pct === 100
                        ? "bg-gradient-to-br from-red-400 via-red-500 to-red-600 text-white"
                        : viewingWeek.weekPct === 100
                          ? "bg-white/15 text-red-50"
                          : "bg-neutral-50"
                    }`}
                  >
                    <div className={`text-[10px] font-medium uppercase ${viewingWeek.days[i].pct === 100 ? "text-red-100" : viewingWeek.weekPct === 100 ? "text-red-100" : "text-neutral-400"}`}>
                      {name}
                    </div>
                    <div className={`mt-0.5 text-sm font-semibold tabular-nums ${viewingWeek.days[i].pct === 100 || viewingWeek.weekPct === 100 ? "text-white" : "text-neutral-800"}`}>
                      {viewingWeek.days[i].pct}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {statsTab === "월별" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMonthlyRangeMode("6months")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  monthlyRangeMode === "6months"
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                최근 6개월
              </button>
              <button
                type="button"
                onClick={() => setMonthlyRangeMode("1year")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  monthlyRangeMode === "1year"
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                최근 1년
              </button>
              <select
                value={monthlyRangeMode === "year" ? monthlyRangeYear : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  setMonthlyRangeYear(Number(v));
                  setMonthlyRangeMode("year");
                }}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700"
              >
                <option value="">연도 선택</option>
                {yearOptions.length === 0 && (
                  <option value={new Date().getFullYear()}>{new Date().getFullYear()}년</option>
                )}
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
            </div>
            {monthlyStatsFiltered.length === 0 ? (
              <p className="text-sm text-neutral-400">해당 기간 기록이 없어요.</p>
            ) : (
              <div className="space-y-2">
                {monthlyStatsFiltered.map(({ month, label, rate, completed, total }) => (
                  <div
                    key={month}
                    className={`flex items-center gap-3 rounded-xl px-4 py-2 ${
                      rate === 100
                        ? "bg-gradient-to-r from-red-400 via-red-500 to-red-600"
                        : "bg-neutral-50"
                    }`}
                  >
                    <span className={`w-24 text-sm font-medium ${rate === 100 ? "text-white" : "text-neutral-700"}`}>{label}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`h-2 w-full overflow-hidden rounded-full ${rate === 100 ? "bg-white/30" : "bg-neutral-200"}`}>
                        <div
                          className={`h-full rounded-full transition-all ${rate === 100 ? "bg-white" : "bg-neutral-700"}`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>
                    <span className={`w-14 text-right text-sm tabular-nums font-medium ${rate === 100 ? "text-white" : "text-neutral-600"}`}>
                      {rate}% ({completed}/{total})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {statsTab === "이번달" && (
          <div className="space-y-6">
            <div
              className={`rounded-2xl border-2 px-6 py-5 text-center ${
                thisMonthCalendar.totalPct === 100
                  ? "border-red-400/80 bg-gradient-to-br from-red-400 via-red-500 to-red-600"
                  : "border-neutral-200 bg-neutral-50"
              }`}
            >
              <p className={thisMonthCalendar.totalPct === 100 ? "text-sm font-medium text-red-100" : "text-sm font-medium text-neutral-500"}>
                {thisMonthCalendar.year}년 {thisMonthCalendar.month}월 총 달성률
              </p>
              <p className={`mt-2 text-4xl font-bold tabular-nums sm:text-5xl ${thisMonthCalendar.totalPct === 100 ? "text-white" : "text-neutral-900"}`}>
                {thisMonthCalendar.totalPct}%
              </p>
            </div>
            <p className="text-base font-medium text-neutral-600">
              {thisMonthCalendar.year}년 {thisMonthCalendar.month}월 · 날짜별 달성률
            </p>
            <div className="w-full min-w-0">
              <div className="grid grid-cols-7 gap-2 text-center text-sm font-semibold text-neutral-500">
                {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                  <div key={d} className="py-2">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2 text-center">
                {thisMonthCalendar.cells.map((cell, i) => (
                  <div
                    key={i}
                    className={`min-h-[4rem] rounded-xl py-3 ${
                      cell.day === null
                        ? "invisible"
                        : cell.pct === 100
                          ? "bg-gradient-to-br from-red-400 via-red-500 to-red-600 text-white"
                          : "bg-neutral-100"
                    }`}
                    title={cell.key ? `${cell.key} ${cell.pct}%` : ""}
                  >
                    {cell.day != null && (
                      <>
                        <div className={`text-base font-semibold ${cell.pct === 100 ? "text-white" : "text-neutral-800"}`}>{cell.day}</div>
                        <div className={`mt-0.5 text-sm font-medium tabular-nums ${cell.pct === 100 ? "text-red-100" : "text-neutral-600"}`}>
                          {cell.pct}%
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
