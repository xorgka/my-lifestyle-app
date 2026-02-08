"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import confetti from "canvas-confetti";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Card } from "@/components/ui/Card";
import {
  loadRoutineItems,
  saveRoutineItems,
  loadRoutineCompletions,
  saveRoutineCompletions,
  type RoutineItem,
} from "@/lib/routineDb";

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
  { id: 1, title: "아침 물 한 잔", isImportant: false },
  { id: 2, title: "10분 스트레칭", isImportant: false },
  { id: 3, title: "오늘의 우선순위 3가지 적기", isImportant: false },
  { id: 4, title: "30분 집중 작업", isImportant: false },
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
  /** 이번달 탭: 보고 있는 연·월 (0 = 이번달, -1 = 지난달, +1 = 다음달 등) */
  const [monthOffset, setMonthOffset] = useState(0);
  /** 이번달 탭: 중요 항목 필터 (null = 전체 달성률, 숫자 = 해당 항목만 O/X) */
  const [selectedImportantItemId, setSelectedImportantItemId] = useState<number | null>(null);
  /** 월별 탭: 중요 항목 필터 (null = 전체, 숫자 = 해당 항목만 O/X 비율) */
  const [selectedMonthlyImportantItemId, setSelectedMonthlyImportantItemId] = useState<number | null>(null);
  /** 이번달 탭: 날짜 클릭 시 해당 날짜 상세 모달 (YYYY-MM-DD 또는 null) */
  const [dayDetailModalKey, setDayDetailModalKey] = useState<string | null>(null);
  /** 오늘의 루틴 목록에서 보고 있는 날짜 (이전/다음 날 이동용) */
  const [listViewDateKey, setListViewDateKey] = useState(() => getTodayKey());
  /** 오늘의 루틴 카드: 편집/항목추가 메뉴 열림 */
  const [listMenuOpen, setListMenuOpen] = useState(false);
  /** 모바일 뷰 여부 (연도 선택 라벨을 "연도"만 표시) */
  const [isNarrowView, setIsNarrowView] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsNarrowView(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const todayKey = getTodayKey();
  const completedToday = useMemo(
    () => new Set(dailyCompletions[todayKey] ?? []),
    [dailyCompletions, todayKey]
  );
  /** 목록에서 보고 있는 날짜의 완료 Set */
  const completedForListViewDate = useMemo(
    () => new Set(dailyCompletions[listViewDateKey] ?? []),
    [dailyCompletions, listViewDateKey]
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
      const dateKey = listViewDateKey;
      const completedSet = new Set(dailyCompletions[dateKey] ?? []);
      const isCompleted = completedSet.has(id);
      setDailyCompletions((prev) => {
        const list = prev[dateKey] ?? [];
        const next = isCompleted ? list.filter((x) => x !== id) : [...list, id];
        return { ...prev, [dateKey]: next };
      });
      if (!isCompleted && dateKey === todayKey) fireConfetti();
    },
    [listViewDateKey, dailyCompletions, todayKey, isDragging]
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
    setItems((prev) => [...prev, { id: newId, title: t, isImportant: false }]);
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

  /** 월별 탭에서 단일(중요) 항목 선택 시: 월별 O/X (한 날 수 / 해당 월 일수) */
  const monthlyStatsBySingleItem = useMemo(() => {
    const itemId = selectedMonthlyImportantItemId;
    if (itemId == null) return null;
    const byMonth: Record<string, { doneDays: number; daysInMonth: number }> = {};
    Object.entries(dailyCompletions).forEach(([key, ids]) => {
      const month = key.slice(0, 7);
      if (!byMonth[month]) {
        const [y, m] = month.split("-").map(Number);
        byMonth[month] = { doneDays: 0, daysInMonth: new Date(y, m, 0).getDate() };
      }
      if (ids.includes(itemId)) byMonth[month].doneDays += 1;
    });
    return Object.entries(byMonth)
      .map(([month, v]) => ({
        month,
        label: `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`,
        doneDays: v.doneDays,
        daysInMonth: v.daysInMonth,
        rate: v.daysInMonth === 0 ? 0 : Math.round((v.doneDays / v.daysInMonth) * 100),
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [dailyCompletions, selectedMonthlyImportantItemId]);

  const monthlyStatsFiltered = useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth() + 1;
    const list =
      selectedMonthlyImportantItemId != null && monthlyStatsBySingleItem != null
        ? monthlyStatsBySingleItem
        : monthlyStatsAll;
    if (monthlyRangeMode === "6months") {
      const cutoff = new Date(thisYear, thisMonth - 1, 1);
      cutoff.setMonth(cutoff.getMonth() - 6);
      const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;
      return list.filter((m) => m.month >= cutoffKey);
    }
    if (monthlyRangeMode === "1year") {
      const cutoff = new Date(thisYear, thisMonth - 1, 1);
      cutoff.setMonth(cutoff.getMonth() - 12);
      const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;
      return list.filter((m) => m.month >= cutoffKey);
    }
    return list.filter((m) => m.month.startsWith(String(monthlyRangeYear)));
  }, [monthlyRangeMode, monthlyRangeYear, monthlyStatsAll, monthlyStatsBySingleItem, selectedMonthlyImportantItemId]);

  const yearOptions = useMemo(() => {
    const years = new Set(monthlyStatsAll.map((m) => m.month.slice(0, 4)));
    return Array.from(years)
      .map(Number)
      .sort((a, b) => b - a);
  }, [monthlyStatsAll]);

  /** 이번달 탭에서 보고 있는 연·월 */
  const viewingMonthDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);
  const viewingYear = viewingMonthDate.getFullYear();
  const viewingMonth = viewingMonthDate.getMonth() + 1;

  const importantItems = useMemo(
    () => items.filter((i) => i.isImportant),
    [items]
  );

  /** 이번달 탭 달력 데이터 (전체 % 또는 단일 항목 O/X) */
  const thisMonthCalendar = useMemo(() => {
    const year = viewingYear;
    const month = viewingMonth;
    const month0 = month - 1;
    const first = new Date(year, month0, 1);
    const last = new Date(year, month, 0);
    const startPad = first.getDay();
    const daysInMonth = last.getDate();
    const totalItems = items.length || 1;
    const singleItemId = selectedImportantItemId;
    const cells: { day: number | null; pct: number; key: string; done?: boolean }[] = [];
    let monthCompleted = 0;
    let doneDays = 0;
    for (let i = 0; i < startPad; i++) cells.push({ day: null, pct: 0, key: "" });
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const completedIds = dailyCompletions[key] ?? [];
      if (singleItemId != null) {
        const done = completedIds.includes(singleItemId);
        if (done) doneDays++;
        cells.push({ day: d, pct: done ? 100 : 0, key, done });
      } else {
        const count = completedIds.length;
        monthCompleted += count;
        cells.push({ day: d, pct: Math.round((count / totalItems) * 100), key });
      }
    }
    while (cells.length % 7 !== 0) cells.push({ day: null, pct: 0, key: "" });
    if (singleItemId != null) {
      const totalPct = daysInMonth === 0 ? 0 : Math.round((doneDays / daysInMonth) * 100);
      return {
        year,
        month,
        cells,
        daysInMonth,
        totalPct,
        singleItemId,
        doneDays,
        totalDays: daysInMonth,
      };
    }
    const totalPossible = daysInMonth * totalItems;
    const totalPct = totalPossible === 0 ? 0 : Math.round((monthCompleted / totalPossible) * 100);
    return { year, month, cells, daysInMonth, totalPct };
  }, [dailyCompletions, items.length, viewingYear, viewingMonth, selectedImportantItemId]);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <SectionTitle
          title="루틴"
          subtitle="체크할수록 폭죽처럼 터지는, 오늘의 작은 승리들."
        />
        <Link
          href="/routine/sleep"
          className="mt-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:border-neutral-800 hover:bg-neutral-800 hover:text-white"
          aria-label="수면 관리"
        >
          <span className="text-2xl" role="img" aria-hidden>🌙</span>
        </Link>
      </div>

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
          <div className="flex min-w-0 flex-1 items-center gap-1.5 md:gap-2">
            <button
              type="button"
              onClick={() => {
                const d = new Date(listViewDateKey + "T12:00:00");
                d.setDate(d.getDate() - 1);
                setListViewDateKey(
                  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                );
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 md:h-9 md:w-9"
              aria-label="이전 날"
            >
              <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="min-w-[7.5rem] shrink-0 text-xl font-semibold text-neutral-900">
              <span className="whitespace-nowrap">오늘의 루틴</span>
              <span className="ml-1.5 text-[13px] font-normal text-neutral-400 md:ml-2 md:text-sm">
                {(() => {
                  const d = new Date(listViewDateKey + "T12:00:00");
                  const w = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
                  return `${d.getMonth() + 1}/${d.getDate()}(${w})`;
                })()}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => {
                const d = new Date(listViewDateKey + "T12:00:00");
                d.setDate(d.getDate() + 1);
                setListViewDateKey(
                  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                );
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 md:h-9 md:w-9"
              aria-label="다음 날"
            >
              <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {/* 모바일: ⋮ 메뉴 하나 */}
          <div className="relative md:hidden">
            <button
              type="button"
              onClick={() => setListMenuOpen((prev) => !prev)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
              aria-label="메뉴"
              aria-expanded={listMenuOpen}
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>
            {listMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden
                  onClick={() => setListMenuOpen(false)}
                />
                <div
                  className="absolute right-0 top-full z-20 mt-1 min-w-[8rem] rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setListEditMode((prev) => {
                        if (prev) setEditingId(null);
                        return !prev;
                      });
                      setListMenuOpen(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-neutral-50 ${
                      listEditMode ? "font-medium text-neutral-800" : "text-neutral-700"
                    }`}
                  >
                    {listEditMode ? "완료" : "편집"}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAddOpen(true);
                      setListMenuOpen(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                  >
                    항목 추가
                  </button>
                </div>
              </>
            )}
          </div>
          {/* PC: 편집 / 항목 추가 버튼 그대로 */}
          <div className="hidden items-center gap-2 md:flex">
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
                      completedForListViewDate.has(item.id)
                        ? "bg-neutral-900 text-white"
                        : "hover:bg-neutral-100 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]"
                    }`}
                  >
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm font-semibold sm:h-6 sm:w-6 ${
                        completedForListViewDate.has(item.id)
                          ? "border-transparent bg-white/20 text-white"
                          : "border-neutral-300 bg-white text-neutral-400"
                      }`}
                    >
                      {completedForListViewDate.has(item.id) ? "✓" : ""}
                    </div>
                    <span
                      className={`min-w-0 flex-1 break-words text-left text-[19.5px] font-semibold sm:text-[1.35rem] ${
                        completedForListViewDate.has(item.id) ? "text-white" : "text-neutral-900"
                      } ${completedForListViewDate.has(item.id) ? "line-through opacity-90" : ""}`}
                    >
                      {item.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setItems((prev) =>
                        prev.map((i) =>
                          i.id === item.id ? { ...i, isImportant: !i.isImportant } : i
                        )
                      );
                    }}
                    className={`shrink-0 rounded-lg p-1.5 transition sm:p-2 ${
                      item.isImportant
                        ? "text-amber-500 hover:bg-amber-50 hover:text-amber-600"
                        : "text-neutral-300 hover:bg-neutral-100 hover:text-neutral-500"
                    }`}
                    title={item.isImportant ? "중요 항목 해제" : "중요 항목으로 표시 (별표를 누르면 이번달 탭에서 이 항목만 O/X로 볼 수 있어요)"}
                    aria-label={item.isImportant ? "중요 항목 해제" : "중요 항목으로 표시"}
                  >
                    <svg className="h-5 w-5 sm:h-5 sm:w-5" fill={item.isImportant ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
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
                {weekDayNames.map((name, i) => {
                  const isToday = viewingWeek.days[i].key === todayKey;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setDayDetailModalKey(viewingWeek.days[i].key)}
                      className={`flex flex-1 flex-col rounded-xl py-2 text-center ${
                        viewingWeek.days[i].pct === 100
                          ? "bg-gradient-to-br from-red-400 via-red-500 to-red-600 text-white"
                          : viewingWeek.weekPct === 100
                            ? "bg-white/15 text-red-50"
                            : "bg-neutral-50"
                      } ${isToday ? "ring-2 ring-neutral-900 ring-offset-2 ring-offset-white" : ""} hover:opacity-90 transition-opacity`}
                    >
                      <div className={`text-sm font-medium uppercase ${viewingWeek.days[i].pct === 100 ? "text-red-100" : viewingWeek.weekPct === 100 ? "text-red-100" : "text-neutral-400"}`}>
                        {name}
                      </div>
                      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${viewingWeek.days[i].pct === 100 || viewingWeek.weekPct === 100 ? "text-white" : "text-neutral-800"}`}>
                        {viewingWeek.days[i].pct}%
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {statsTab === "월별" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex w-full flex-1 items-center justify-between gap-2 min-w-0 md:w-auto md:flex-initial md:justify-start">
                <button
                  type="button"
                  onClick={() => setMonthlyRangeMode("6months")}
                  className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition md:flex-none md:px-3 ${
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
                  className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition md:flex-none md:px-3 ${
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
                  className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-700 md:w-auto md:flex-none md:px-3"
                >
                  <option value="">{isNarrowView ? "연도" : "연도 선택"}</option>
                  {yearOptions.length === 0 && (
                    <option value={new Date().getFullYear()}>{new Date().getFullYear()}년</option>
                  )}
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
              </div>
              <div className="flex w-full items-center gap-2 justify-end shrink-0 md:w-auto md:justify-start">
                <span className="text-sm text-neutral-500 shrink-0">중요 항목:</span>
                <select
                  value={selectedMonthlyImportantItemId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedMonthlyImportantItemId(v === "" ? null : Number(v));
                  }}
                  className="min-w-0 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 md:min-w-[10rem]"
                >
                  <option value="">전체 (달성률 %)</option>
                  {importantItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
                  {importantItems.length === 0 && (
                    <option value="" disabled>중요 항목 없음</option>
                  )}
                </select>
              </div>
            </div>
            {monthlyStatsFiltered.length === 0 ? (
              <p className="text-sm text-neutral-400">해당 기간 기록이 없어요.</p>
            ) : (
              <div className="space-y-2">
                {monthlyStatsFiltered.map((row) => {
                  const rate = row.rate;
                  const isSingleItem = "doneDays" in row && "daysInMonth" in row;
                  const displayText = isSingleItem
                    ? `${(row as { doneDays: number; daysInMonth: number }).doneDays}/${(row as { daysInMonth: number }).daysInMonth} (${rate}%)`
                    : `${rate}% (${(row as { completed: number }).completed}/${(row as { total: number }).total})`;
                  const isFull = rate === 100;
                  return (
                    <div
                      key={row.month}
                      className={`flex items-center gap-3 rounded-xl px-4 py-2 ${
                        isFull
                          ? isSingleItem
                            ? "bg-gradient-to-r from-neutral-600 via-neutral-800 to-neutral-950"
                            : "bg-gradient-to-r from-red-400 via-red-500 to-red-600"
                          : "bg-neutral-50"
                      }`}
                    >
                      <span className={`w-24 text-sm font-medium ${isFull ? "text-white" : "text-neutral-700"}`}>{row.label}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`h-2 w-full overflow-hidden rounded-full ${isFull ? "bg-white/30" : "bg-neutral-200"}`}>
                          <div
                            className={`h-full rounded-full transition-all ${isFull ? "bg-white" : "bg-neutral-700"}`}
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </div>
                      <span className={`w-28 text-right text-sm tabular-nums font-medium ${isFull ? "text-white" : "text-neutral-600"}`}>
                        {displayText}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {statsTab === "이번달" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3">
              <div className="flex w-full items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setMonthOffset((o) => o - 1)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
                  aria-label="이전 달"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="min-w-0 flex-1 text-center text-base font-semibold text-neutral-900">
                  {thisMonthCalendar.year}년 {thisMonthCalendar.month}월
                </span>
                <button
                  type="button"
                  onClick={() => setMonthOffset((o) => o + 1)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
                  aria-label="다음 달"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="flex w-full items-center justify-end gap-2 md:justify-between">
                <span className="text-sm text-neutral-500 shrink-0">중요 항목:</span>
                <select
                  value={selectedImportantItemId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedImportantItemId(v === "" ? null : Number(v));
                  }}
                  className="min-w-[10rem] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                >
                  <option value="">전체 (달성률 %)</option>
                  {importantItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
                  {importantItems.length === 0 && (
                    <option value="" disabled>중요 항목 없음</option>
                  )}
                </select>
              </div>
            </div>
            <div
              className={`rounded-2xl border-2 px-6 py-5 text-center ${
                thisMonthCalendar.totalPct === 100
                  ? "border-red-400/80 bg-gradient-to-br from-red-400 via-red-500 to-red-600"
                  : "border-neutral-200 bg-neutral-50"
              }`}
            >
              <p className={thisMonthCalendar.totalPct === 100 ? "text-sm font-medium text-red-100" : "text-sm font-medium text-neutral-500"}>
                {thisMonthCalendar.year}년 {thisMonthCalendar.month}월
                {"singleItemId" in thisMonthCalendar && thisMonthCalendar.singleItemId != null
                  ? " O/X 달성"
                  : " 총 달성률"}
              </p>
              <p className={`mt-2 text-4xl font-bold tabular-nums sm:text-5xl ${thisMonthCalendar.totalPct === 100 ? "text-white" : "text-neutral-900"}`}>
                {"doneDays" in thisMonthCalendar && "totalDays" in thisMonthCalendar
                  ? `${thisMonthCalendar.doneDays}/${thisMonthCalendar.totalDays} (${thisMonthCalendar.totalPct}%)`
                  : `${thisMonthCalendar.totalPct}%`}
              </p>
            </div>
            <p className="text-base font-medium text-neutral-600">
              {thisMonthCalendar.year}년 {thisMonthCalendar.month}월
              {"singleItemId" in thisMonthCalendar && thisMonthCalendar.singleItemId != null
                ? " · 날짜별 O/X"
                : " · 날짜별 달성률"}
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
                {thisMonthCalendar.cells.map((cell, i) => {
                  const isToday = cell.key === todayKey;
                  const isOX = "done" in cell && cell.done !== undefined;
                  const isDone = isOX ? cell.done : cell.pct === 100;
                  const isSingleItemView = isOX;
                  const doneBg = isSingleItemView
                    ? "bg-gradient-to-br from-neutral-600 via-neutral-800 to-neutral-950 text-white"
                    : "bg-gradient-to-br from-red-400 via-red-500 to-red-600 text-white";
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => cell.key && setDayDetailModalKey(cell.key)}
                      className={`min-h-[4rem] w-full rounded-xl py-3 text-center ${
                        cell.day === null
                          ? "invisible cursor-default"
                          : isDone
                            ? doneBg
                            : "bg-neutral-100 hover:bg-neutral-200"
                      } ${isToday ? "ring-2 ring-neutral-900 ring-offset-2" : ""} ${cell.day != null ? "cursor-pointer" : ""}`}
                      title={cell.key ? (isOX ? `${cell.key} ${cell.done ? "O" : "X"}` : `${cell.key} ${cell.pct}%`) : ""}
                      disabled={!cell.key}
                    >
                      {cell.day != null && (
                        <>
                          <div className={`text-base font-semibold ${isDone ? "text-white" : "text-neutral-800"}`}>
                            {cell.day}
                          </div>
                          <div className={`mt-0.5 text-sm font-medium tabular-nums ${isDone ? (isSingleItemView ? "text-neutral-300" : "text-red-100") : "text-neutral-600"}`}>
                            {isOX ? (cell.done ? "O" : "X") : `${cell.pct}%`}
                          </div>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 이번달 탭: 날짜 클릭 시 해당 날짜 루틴 전체(했음/안 함) 모달 */}
      {dayDetailModalKey &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center bg-black/70 p-4"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={() => setDayDetailModalKey(null)}
            role="dialog"
            aria-modal="true"
            aria-label={`${dayDetailModalKey} 루틴 내역`}
          >
            <div
              className="relative flex w-full max-w-[calc(100vw-4rem)] items-center justify-center md:max-w-none md:gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 좌측: 이전 날짜 - 모바일에서만 모달에 겹침, PC에서는 모달 옆 */}
              <button
                type="button"
                onClick={() => {
                  const d = new Date(dayDetailModalKey + "T12:00:00");
                  d.setDate(d.getDate() - 1);
                  setDayDetailModalKey(
                    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                  );
                }}
                className="absolute -left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 shrink-0 items-center justify-center rounded-full bg-white/95 text-neutral-700 shadow-lg transition hover:bg-white hover:text-neutral-900 md:static md:left-auto md:translate-y-0 md:h-12 md:w-12"
                aria-label="이전 날짜"
              >
                <svg className="h-5 w-5 md:h-6 md:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="relative max-h-[85vh] w-full min-w-0 overflow-y-auto rounded-2xl bg-white py-4 px-6 shadow-xl md:max-w-md md:py-6 md:px-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                {(() => {
                  const d = new Date(dayDetailModalKey + "T12:00:00");
                  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
                })()}
              </h3>
              {(() => {
                const completedIds = dailyCompletions[dayDetailModalKey] ?? [];
                const total = items.length || 1;
                const pct = Math.round((completedIds.length / total) * 100);
                return (
                  <div className="mt-3 rounded-xl bg-neutral-100 px-4 py-2.5">
                    <span className="text-sm font-medium text-neutral-600">이날 달성률</span>
                    <span className="ml-2 text-xl font-bold tabular-nums text-neutral-900">{pct}%</span>
                    <span className="ml-1 text-sm text-neutral-500">({completedIds.length}/{total})</span>
                  </div>
                );
              })()}
              <ul className="mt-4 space-y-2">
                {(() => {
                  const completedIds = new Set(dailyCompletions[dayDetailModalKey] ?? []);
                  return items.map((item) => {
                    const done = completedIds.has(item.id);
                    return (
                      <li
                        key={item.id}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                          done
                            ? "border-neutral-200 bg-neutral-100 text-neutral-800"
                            : "border-neutral-200 bg-neutral-50 text-neutral-500"
                        }`}
                      >
                        <span className="font-medium">{item.title}</span>
                        <span className={`text-sm font-semibold ${done ? "text-green-600" : "text-neutral-400"}`}>
                          {done ? "했음" : "안 함"}
                        </span>
                      </li>
                    );
                  });
                })()}
              </ul>
              {items.length === 0 && (
                <p className="mt-4 text-sm text-neutral-400">등록된 루틴 항목이 없어요.</p>
              )}
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDayDetailModalKey(null)}
                  className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-300"
                >
                  닫기
                </button>
              </div>
              </div>
              {/* 우측: 다음 날짜 - 모바일에서만 모달에 겹침, PC에서는 모달 옆 */}
              <button
                type="button"
                onClick={() => {
                  const d = new Date(dayDetailModalKey + "T12:00:00");
                  d.setDate(d.getDate() + 1);
                  setDayDetailModalKey(
                    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                  );
                }}
                className="absolute -right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 shrink-0 items-center justify-center rounded-full bg-white/95 text-neutral-700 shadow-lg transition hover:bg-white hover:text-neutral-900 md:static md:right-auto md:translate-y-0 md:h-12 md:w-12"
                aria-label="다음 날짜"
              >
                <svg className="h-5 w-5 md:h-6 md:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
