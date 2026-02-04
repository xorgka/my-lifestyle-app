"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Card } from "@/components/ui/Card";
import {
  type BudgetEntry,
  type CategoryId,
  type CategoryKeywords,
  type MonthExtraKeywords,
  CATEGORY_LABELS,
  DEFAULT_KEYWORDS,
  EXCLUDE_FROM_MONTH_TOTAL,
  getCategoryForEntry,
  getKeywordsForMonth,
  getThisWeekEnd,
  getThisWeekStart,
  isExcludedFromMonthTotal,
  loadAnnualExpense,
  loadEntries,
  loadKeywords,
  loadMonthExtras,
  saveEntries,
  saveKeywords,
  saveMonthExtras,
  todayStr,
  toYearMonth,
} from "@/lib/budget";
import { type IncomeEntry, loadIncomeEntries } from "@/lib/income";
import * as XLSX from "xlsx";

function formatNum(n: number): string {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const week = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${m}월 ${day}일 (${week})`;
}

type ViewMode = "week" | "thisMonth" | "lastMonth" | "custom";

/** 항목 자동완성 기본 추가 후보 */
const ITEM_SUGGESTION_DEFAULTS = [
  "강아지 사료",
  "주유소",
  "쿠캣",
  "아이스크림",
  "KB카드출금",
  "부가세",
  "종합소득세",
  "자동차세",
  "면허세",
];

export default function FinancePage() {
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [keywords, setKeywords] = useState<CategoryKeywords>(DEFAULT_KEYWORDS);
  const [monthExtras, setMonthExtras] = useState<MonthExtraKeywords>({});
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [viewMode, setViewMode] = useState<ViewMode>("thisMonth");
  const [customYear, setCustomYear] = useState(new Date().getFullYear());
  const [customMonth, setCustomMonth] = useState(new Date().getMonth() + 1);
  const [newItem, setNewItem] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [showKeywordModal, setShowKeywordModal] = useState(false);
  const [addKeywordCategory, setAddKeywordCategory] = useState<CategoryId | null>(null);
  const [addKeywordValue, setAddKeywordValue] = useState("");
  const [addKeywordPersist, setAddKeywordPersist] = useState<boolean | null>(null);
  const [pendingKeyword, setPendingKeyword] = useState<{ cat: CategoryId; value: string } | null>(null);
  const [categoryDetailModal, setCategoryDetailModal] = useState<CategoryId | null>(null);
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null);
  const [itemSuggestionsOpen, setItemSuggestionsOpen] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [exportRange, setExportRange] = useState<"year" | "month" | "months">("year");
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
  const [exportMonths, setExportMonths] = useState<number[]>([]);
  const [dayDetailEditingId, setDayDetailEditingId] = useState<string | null>(null);
  const [dayDetailEditItem, setDayDetailEditItem] = useState("");
  const [dayDetailEditAmount, setDayDetailEditAmount] = useState("");
  const itemInputRef = useRef<HTMLInputElement>(null);
  const itemSuggestionsRef = useRef<HTMLUListElement>(null);

  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [annualExpenseByYear, setAnnualExpenseByYear] = useState<Record<string, number>>({});

  const [budgetLoading, setBudgetLoading] = useState(true);
  const load = useCallback(async () => {
    setBudgetLoading(true);
    try {
      const [e, k, m] = await Promise.all([
        loadEntries(),
        loadKeywords(),
        loadMonthExtras(),
      ]);
      setEntries(e);
      setKeywords(k);
      setMonthExtras(m);
      setIncomeEntries(loadIncomeEntries());
      setAnnualExpenseByYear(loadAnnualExpense());
    } finally {
      setBudgetLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const yearMonthForView = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    if (viewMode === "thisMonth") return `${y}-${String(m).padStart(2, "0")}`;
    if (viewMode === "lastMonth") {
      const lm = m === 1 ? 12 : m - 1;
      const ly = m === 1 ? y - 1 : y;
      return `${ly}-${String(lm).padStart(2, "0")}`;
    }
    if (viewMode === "custom")
      return `${customYear}-${String(customMonth).padStart(2, "0")}`;
    return toYearMonth(todayStr());
  }, [viewMode, customYear, customMonth]);

  const keywordsForSelectedMonth = getKeywordsForMonth(
    keywords,
    monthExtras,
    toYearMonth(selectedDate)
  );
  const keywordsForViewMonth = getKeywordsForMonth(
    keywords,
    monthExtras,
    yearMonthForView
  );

  /** 검색어가 있으면 항목명 기준으로 필터 (표시용) */
  const displayEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.item.toLowerCase().includes(q));
  }, [entries, searchQuery]);

  const entriesForSelectedDay = useMemo(
    () => displayEntries.filter((e) => e.date === selectedDate),
    [displayEntries, selectedDate]
  );

  /** 항목 자동완성 후보: 기본 후보 + 등록 키워드 + 자주 쓰는 항목(2회 이상) */
  const itemSuggestionCandidates = useMemo(() => {
    const ym = toYearMonth(selectedDate);
    const kw = getKeywordsForMonth(keywords, monthExtras, ym);
    const fromKeywords = new Set<string>();
    (Object.keys(kw) as CategoryId[]).forEach((cat) => {
      kw[cat].forEach((w) => fromKeywords.add(w.trim()));
    });
    const countByItem: Record<string, number> = {};
    entries.forEach((e) => {
      const item = e.item.trim();
      if (item) countByItem[item] = (countByItem[item] ?? 0) + 1;
    });
    const frequent = Object.entries(countByItem)
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([item]) => item);
    const combined = [...ITEM_SUGGESTION_DEFAULTS, ...fromKeywords, ...frequent];
    return [...new Set(combined)].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [keywords, monthExtras, selectedDate, entries]);

  const itemSuggestionsFiltered = useMemo(() => {
    const q = newItem.trim().toLowerCase();
    if (!q) return itemSuggestionCandidates.slice(0, 12);
    return itemSuggestionCandidates.filter(
      (s) => s.toLowerCase().includes(q) || s.toLowerCase().startsWith(q)
    ).slice(0, 12);
  }, [newItem, itemSuggestionCandidates]);

  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, [itemSuggestionsFiltered.length]);

  const weekStart = getThisWeekStart();
  const weekEnd = getThisWeekEnd();
  const thisWeekEntries = useMemo(
    () =>
      displayEntries.filter((e) => e.date >= weekStart && e.date <= weekEnd),
    [displayEntries, weekStart, weekEnd]
  );
  const thisWeekTotal = useMemo(
    () => thisWeekEntries.reduce((s, e) => s + e.amount, 0),
    [thisWeekEntries]
  );

  const viewMonthEntries = useMemo(
    () =>
      displayEntries.filter((e) => toYearMonth(e.date) === yearMonthForView),
    [displayEntries, yearMonthForView]
  );
  const viewMonthTotalRaw = useMemo(
    () => viewMonthEntries.reduce((s, e) => s + e.amount, 0),
    [viewMonthEntries]
  );
  const viewMonthExcluded = useMemo(
    () =>
      viewMonthEntries
        .filter((e) => isExcludedFromMonthTotal(e.item))
        .reduce((s, e) => s + e.amount, 0),
    [viewMonthEntries]
  );
  const viewMonthTotalDisplay = viewMonthTotalRaw - viewMonthExcluded;

  const viewMonthByCategory = useMemo(() => {
    const map: Record<CategoryId, number> = {
      고정비: 0,
      사업경비: 0,
      세금: 0,
      생활비: 0,
      신용카드: 0,
    };
    viewMonthEntries.forEach((e) => {
      const cat = getCategoryForEntry(e.item, keywordsForViewMonth);
      map[cat] += e.amount;
    });
    return map;
  }, [viewMonthEntries, keywordsForViewMonth]);

  const viewMonthByDay = useMemo(() => {
    const map: Record<string, BudgetEntry[]> = {};
    viewMonthEntries.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    Object.keys(map).forEach((d) =>
      map[d].sort((a, b) => a.item.localeCompare(b.item))
    );
    return map;
  }, [viewMonthEntries]);

  /** 해당 월 달력 그리드 (7×6): 각 셀은 null 또는 { day, dateStr } */
  const viewMonthCalendar = useMemo(() => {
    const [y, m] = yearMonthForView.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const firstDayOfWeek = new Date(y, m - 1, 1).getDay();
    const cells: ({ day: number; dateStr: string } | null)[] = [];
    for (let i = 0; i < 42; i++) {
      if (i < firstDayOfWeek || i >= firstDayOfWeek + lastDay) {
        cells.push(null);
      } else {
        const day = i - firstDayOfWeek + 1;
        cells.push({
          day,
          dateStr: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        });
      }
    }
    return { cells, weekLabels: ["일", "월", "화", "수", "목", "금", "토"] };
  }, [yearMonthForView]);

  /** 카테고리별 → 항목별 상세 (모달용): { 항목명: { total, entries: { date, amount }[] } } */
  const viewMonthByCategoryDetail = useMemo(() => {
    const out: Record<CategoryId, Record<string, { total: number; entries: { date: string; amount: number }[] }>> = {
      고정비: {},
      사업경비: {},
      세금: {},
      생활비: {},
      신용카드: {},
    };
    viewMonthEntries.forEach((e) => {
      const cat = getCategoryForEntry(e.item, keywordsForViewMonth);
      if (!out[cat][e.item]) out[cat][e.item] = { total: 0, entries: [] };
      out[cat][e.item].total += e.amount;
      out[cat][e.item].entries.push({ date: e.date, amount: e.amount });
    });
    (Object.keys(out) as CategoryId[]).forEach((cat) => {
      Object.keys(out[cat]).forEach((item) => {
        out[cat][item].entries.sort((a, b) => a.date.localeCompare(b.date));
      });
    });
    return out;
  }, [viewMonthEntries, keywordsForViewMonth]);

  const addEntry = () => {
    const item = newItem.trim();
    const amount = Number(String(newAmount).replace(/,/g, ""));
    if (!item || !Number.isFinite(amount) || amount <= 0) return;
    const id = `e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const next: BudgetEntry[] = [
      ...entries,
      { id, date: selectedDate, item, amount },
    ];
    setEntries(next);
    saveEntries(next)
      .then((updated) => setEntries(updated))
      .catch((err) => {
        console.error(err);
        load();
      });
    setNewItem("");
    setNewAmount("");
  };

  const removeEntry = (id: string) => {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    saveEntries(next)
      .then((updated) => setEntries(updated))
      .catch((err) => {
        console.error(err);
        load();
      });
  };

  const updateEntry = (id: string, item: string, amount: number) => {
    const trimmed = item.trim();
    if (!trimmed || !Number.isFinite(amount) || amount <= 0) return;
    const next = entries.map((e) =>
      e.id === id ? { ...e, item: trimmed, amount } : e
    );
    setEntries(next);
    saveEntries(next)
      .then((updated) => setEntries(updated))
      .catch((err) => {
        console.error(err);
        load();
      });
  };

  const addKeywordToCategory = (cat: CategoryId, word: string, persist: boolean) => {
    const w = word.trim();
    if (!w) return;
    const base = keywords[cat];
    const ym = toYearMonth(todayStr());
    const alreadyInBase = base.includes(w);
    const alreadyInExtra = (monthExtras[ym]?.[cat] ?? []).includes(w);
    if (alreadyInBase || alreadyInExtra) {
      setAddKeywordCategory(null);
      setAddKeywordValue("");
      setPendingKeyword(null);
      return;
    }
    if (persist) {
      const nextKeywords: CategoryKeywords = {
        ...keywords,
        [cat]: [...keywords[cat], w],
      };
      setKeywords(nextKeywords);
      saveKeywords(nextKeywords).catch(console.error);
    } else {
      const nextExtras: MonthExtraKeywords = {
        ...monthExtras,
        [ym]: {
          ...monthExtras[ym],
          [cat]: [...(monthExtras[ym]?.[cat] ?? []), w],
        },
      };
      setMonthExtras(nextExtras);
      saveMonthExtras(nextExtras).catch(console.error);
    }
    setAddKeywordCategory(null);
    setAddKeywordValue("");
    setAddKeywordPersist(null);
    setPendingKeyword(null);
  };

  const removeKeyword = (cat: CategoryId, word: string, isMonthOnly: boolean) => {
    if (isMonthOnly) {
      const ym = toYearMonth(todayStr());
      const current = monthExtras[ym]?.[cat] ?? [];
      const next = current.filter((x) => x !== word);
      const nextExtras: MonthExtraKeywords = { ...monthExtras };
      if (next.length === 0) {
        const o = { ...nextExtras[ym] };
        delete o[cat];
        if (Object.keys(o).length === 0) delete nextExtras[ym];
        else nextExtras[ym] = o;
      } else {
        nextExtras[ym] = { ...nextExtras[ym], [cat]: next };
      }
      setMonthExtras(nextExtras);
      saveMonthExtras(nextExtras).catch(console.error);
    } else {
      const next: CategoryKeywords = {
        ...keywords,
        [cat]: keywords[cat].filter((x) => x !== word),
      };
      setKeywords(next);
      saveKeywords(next).catch(console.error);
    }
  };

  const getKeywordsForCategoryInMonth = (cat: CategoryId, yearMonth: string) => {
    const base = keywords[cat] ?? [];
    const extra = monthExtras[yearMonth]?.[cat] ?? [];
    return { base, extra, all: [...base, ...extra] };
  };

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => y - 2 + i);
  }, []);
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => i + 1),
    []
  );

  const getEntriesForExport = useCallback(() => {
    const y = String(exportYear);
    if (exportRange === "year") {
      return entries.filter((e) => e.date.startsWith(y));
    }
    if (exportRange === "month") {
      const prefix = `${y}-${String(exportMonth).padStart(2, "0")}`;
      return entries.filter((e) => e.date.startsWith(prefix));
    }
    if (exportRange === "months" && exportMonths.length > 0) {
      return entries.filter((e) => {
        if (!e.date.startsWith(y)) return false;
        const m = Number(e.date.slice(5, 7));
        return exportMonths.includes(m);
      });
    }
    return entries.filter((e) => e.date.startsWith(y));
  }, [entries, exportYear, exportRange, exportMonth, exportMonths]);

  const runExportExcel = () => {
    const toExport = getEntriesForExport();
    const sorted = [...toExport].sort((a, b) => a.date.localeCompare(b.date));
    const rows: (string | number)[][] = [
      ["날짜", "항목", "구분", "금액"],
      ...sorted.map((e) => {
        const kw = getKeywordsForMonth(keywords, monthExtras, toYearMonth(e.date));
        const cat = getCategoryForEntry(e.item, kw);
        return [e.date, e.item, CATEGORY_LABELS[cat], e.amount];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "가계부");
    const suffix =
      exportRange === "year"
        ? `${exportYear}년`
        : exportRange === "month"
          ? `${exportYear}-${String(exportMonth).padStart(2, "0")}`
          : exportMonths.length > 0
            ? `${exportYear}-${exportMonths.sort((a, b) => a - b).join("-")}`
            : exportYear;
    const fileName = `가계부_${suffix}.xlsx`;
    XLSX.writeFile(wb, fileName);
    setShowExportModal(false);
  };

  const toggleExportMonth = (m: number) => {
    setExportMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)
    );
  };

  /** 연도별 총 매출·지출·순수익·월평균수익 (수입 데이터 + 연도별 총 지출 연동) */
  const yearlySummary = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearList = Array.from({ length: currentYear - 2020 }, (_, i) => 2021 + i);
    return yearList.map((y) => {
      const 매출 = incomeEntries.filter((e) => e.year === y).reduce((s, e) => s + e.amount, 0);
      const 지출 =
        annualExpenseByYear[String(y)] ??
        entries.filter((e) => e.date.startsWith(String(y))).reduce((s, e) => s + e.amount, 0);
      const 순수익 = 매출 - 지출;
      const 월평균수익 = 12 > 0 ? 순수익 / 12 : 0;
      return { year: y, 매출, 지출, 순수익, 월평균수익 };
    });
  }, [incomeEntries, annualExpenseByYear, entries]);

  return (
    <div className="min-w-0 space-y-6">
      <SectionTitle
        title="가계부"
        subtitle="일별로 항목과 지출을 입력하고, 월별·주간으로 한눈에 보세요."
      />
      {budgetLoading && (
        <p className="text-sm text-neutral-500">불러오는 중…</p>
      )}

      {/* 모바일: 키워드관리/내보내기 위 → 검색창 아래. PC: 한 줄 유지 (검색·건수·버튼) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="order-1 flex flex-wrap items-center gap-2 sm:order-3 sm:ml-auto">
          <button
            type="button"
            onClick={() => setShowKeywordModal(true)}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
          >
            키워드 관리
          </button>
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
          >
            내보내기 (엑셀)
          </button>
        </div>
        <div className="order-2 relative flex w-full min-w-0 flex-1 items-center sm:order-1 sm:min-w-[200px] md:max-w-md">
          <span className="pointer-events-none absolute left-3 text-neutral-400" aria-hidden>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="항목으로 검색"
            className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-10 text-sm text-neutral-800 placeholder:text-neutral-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              aria-label="검색 지우기"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {searchQuery.trim() && (
          <span className="order-3 text-sm text-neutral-500 sm:order-2">
            검색 결과 <strong className="text-neutral-700">{displayEntries.length}</strong>건
          </span>
        )}
      </div>

      {searchQuery.trim() && (
        <Card className="border-2 border-slate-200 bg-slate-50/30">
          <h3 className="text-lg font-semibold text-neutral-900">
            검색 결과 – &quot;{searchQuery.trim()}&quot;
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            항목명에 맞는 지출 내역이에요. 아래 기간별 보기에도 동일하게 반영돼요.
          </p>
          {displayEntries.length === 0 ? (
            <p className="mt-4 py-6 text-center text-sm text-neutral-500">
              검색어에 맞는 지출이 없어요.
            </p>
          ) : (
            <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-neutral-200 bg-white">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-neutral-100">
                  <tr className="text-left text-neutral-500">
                    <th className="px-3 py-2 font-medium">날짜</th>
                    <th className="px-3 py-2 font-medium">항목</th>
                    <th className="px-3 py-2 font-medium">구분</th>
                    <th className="px-3 py-2 text-right font-medium">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {displayEntries
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((e) => {
                      const kw = getKeywordsForMonth(keywords, monthExtras, toYearMonth(e.date));
                      const cat = getCategoryForEntry(e.item, kw);
                      return (
                        <tr key={e.id} className="border-t border-neutral-100">
                          <td className="px-3 py-2 text-neutral-700">{formatDateLabel(e.date)}</td>
                          <td className="px-3 py-2 text-neutral-800">{e.item}</td>
                          <td className="px-3 py-2 text-neutral-600">{CATEGORY_LABELS[cat]}</td>
                          <td className="px-3 py-2 text-right font-medium text-neutral-900">
                            {formatNum(e.amount)}원
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* 일별 입력 */}
      <Card>
        <h2 className="text-lg font-semibold text-neutral-900">일별 지출 입력</h2>
        <p className="mt-1 text-sm text-neutral-500">
          날짜를 선택한 뒤 항목과 금액을 입력하세요. 항목명에 따라 고정비·사업경비·생활비·신용카드로 자동 분류돼요.
        </p>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            addEntry();
          }}
        >
          <div>
            <label className="block text-xs font-medium text-neutral-500">날짜</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mt-1 block rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
            />
          </div>
          <div className="relative min-w-[180px]">
            <label className="text-xs font-medium text-neutral-500">항목</label>
            <input
              ref={itemInputRef}
              type="text"
              value={newItem}
              onChange={(e) => {
                setNewItem(e.target.value);
                setSelectedSuggestionIndex(0);
                setItemSuggestionsOpen(true);
              }}
              onFocus={() => setItemSuggestionsOpen(true)}
              onBlur={() => {
                setTimeout(() => setItemSuggestionsOpen(false), 150);
              }}
              onKeyDown={(e) => {
                if (!itemSuggestionsOpen || itemSuggestionsFiltered.length === 0) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelectedSuggestionIndex((i) =>
                    i < itemSuggestionsFiltered.length - 1 ? i + 1 : 0
                  );
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelectedSuggestionIndex((i) =>
                    i > 0 ? i - 1 : itemSuggestionsFiltered.length - 1
                  );
                } else if (e.key === "Enter" && itemSuggestionsFiltered.length > 0) {
                  e.preventDefault();
                  setNewItem(itemSuggestionsFiltered[selectedSuggestionIndex] ?? "");
                  setItemSuggestionsOpen(false);
                } else if (e.key === "Escape") {
                  setItemSuggestionsOpen(false);
                }
              }}
              placeholder="예: GPT, 배달, 악사보험"
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400"
              autoComplete="off"
            />
            {itemSuggestionsOpen && itemSuggestionsFiltered.length > 0 && (
              <ul
                ref={itemSuggestionsRef}
                className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
              >
                {itemSuggestionsFiltered.map((s, i) => (
                  <li key={s}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setNewItem(s);
                        setItemSuggestionsOpen(false);
                        itemInputRef.current?.focus();
                      }}
                      className={`w-full px-3 py-2 text-left text-sm ${
                        i === selectedSuggestionIndex
                          ? "bg-slate-100 font-medium text-neutral-900"
                          : "text-neutral-700 hover:bg-slate-50"
                      }`}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="w-28">
            <label className="text-xs font-medium text-neutral-500">금액</label>
            <input
              type="number"
              min={1}
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700"
          >
            추가
          </button>
        </form>
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-medium text-neutral-600">
              {formatDateLabel(selectedDate)} 내역
            </div>
            <div className="text-right">
              <span className="text-sm font-medium text-neutral-500">오늘 지출</span>
              <span className="ml-2 text-xl font-semibold tracking-tight text-neutral-900">
                {formatNum(entriesForSelectedDay.reduce((s, e) => s + e.amount, 0))}원
              </span>
            </div>
          </div>
          {entriesForSelectedDay.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-400">해당 날짜에 입력된 내역이 없어요.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {entriesForSelectedDay.map((e) => {
                const cat = getCategoryForEntry(e.item, keywordsForSelectedMonth);
                return (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium text-neutral-800">{e.item}</span>
                      <span className="ml-2 text-xs text-neutral-500">{CATEGORY_LABELS[cat]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900">
                        {formatNum(e.amount)}원
                      </span>
                      <button
                        type="button"
                        onClick={() => removeEntry(e.id)}
                        className="text-neutral-400 hover:text-red-600"
                        aria-label="삭제"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      {/* 보기: 이번주 / 이번달 / 지난달 / 특정 연·월 */}
      <Card>
        <h2 className="text-lg font-semibold text-neutral-900">기간별 보기</h2>
        <div className="mt-3 mb-8 flex flex-wrap gap-2">
          {(
            [
              { mode: "week" as ViewMode, label: "이번주" },
              { mode: "thisMonth" as ViewMode, label: "이번달" },
              { mode: "lastMonth" as ViewMode, label: "지난달" },
              { mode: "custom" as ViewMode, label: "특정 연·월" },
            ] as const
          ).map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                viewMode === mode
                  ? "bg-neutral-800 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {viewMode === "custom" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={customYear}
              onChange={(e) => setCustomYear(Number(e.target.value))}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <select
              value={customMonth}
              onChange={(e) => setCustomMonth(Number(e.target.value))}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              {months.map((m) => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
        )}

        {viewMode === "week" && (
          <div className="mt-4">
            <div className="text-2xl font-semibold text-neutral-900">
              이번주 총 지출: {formatNum(thisWeekTotal)}원
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              {weekStart} ~ {weekEnd} (일~토)
            </p>
            {thisWeekEntries.length > 0 && (
              <ul className="mt-4 space-y-2">
                {thisWeekEntries
                  .sort((a, b) => a.date.localeCompare(b.date) || a.item.localeCompare(b.item))
                  .map((e) => {
                    const kw = getKeywordsForMonth(keywords, monthExtras, toYearMonth(e.date));
                    const cat = getCategoryForEntry(e.item, kw);
                    return (
                      <li
                        key={e.id}
                        className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base shadow-sm ring-1 ring-neutral-100"
                      >
                        <div className="flex items-baseline gap-3">
                          <span className="font-semibold text-neutral-900">{e.item}</span>
                          <span className="text-sm font-medium text-neutral-500">
                            {formatDateLabel(e.date)}
                          </span>
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                            {CATEGORY_LABELS[cat]}
                          </span>
                        </div>
                        <span className="text-lg font-semibold text-neutral-900">
                          {formatNum(e.amount)}원
                        </span>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        )}

        {(viewMode === "thisMonth" || viewMode === "lastMonth" || viewMode === "custom") && (
          <div className="mt-4 space-y-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-2xl font-semibold text-neutral-900">
                <span>월 지출: {formatNum(viewMonthTotalDisplay)}원</span>
                <span
                  title={
                    viewMonthExcluded > 0
                      ? `적금·IRP·ISA·주택청약은 제외한 금액이에요. (제외: ${formatNum(viewMonthExcluded)}원)`
                      : "적금·IRP·ISA·주택청약은 제외한 금액이에요."
                  }
                  className="flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-xs font-medium text-neutral-500 transition hover:border-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
                >
                  ?
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              {(Object.keys(viewMonthByCategory) as CategoryId[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryDetailModal(cat)}
                  className="rounded-full border border-slate-200 bg-slate-50/80 px-4 py-2 text-neutral-800 transition hover:border-slate-400 hover:bg-slate-200 hover:shadow-sm inline-flex items-center gap-3"
                >
                  <span className="font-semibold">{CATEGORY_LABELS[cat]}</span>
                  <span className="font-medium">{formatNum(viewMonthByCategory[cat])}원</span>
                </button>
              ))}
            </div>
            <div className="mt-8 pt-4">
              <div className="text-base font-semibold text-neutral-800">[ 해당 월 일별 내역 ]</div>
              {Object.keys(viewMonthByDay).length === 0 ? (
                <p className="mt-3 text-sm text-neutral-400">해당 월에 입력된 내역이 없어요.</p>
              ) : (
                <div className="mt-3">
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-neutral-400 sm:gap-1.5 sm:text-[11px]">
                    {viewMonthCalendar.weekLabels.map((w) => (
                      <span key={w}>{w}</span>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1 sm:mt-1.5 sm:gap-1.5">
                    {viewMonthCalendar.cells.map((cell, i) => {
                      if (cell === null) {
                        return <div key={i} className="aspect-square rounded-lg" />;
                      }
                      const { day, dateStr } = cell;
                      const entries = viewMonthByDay[dateStr];
                      const total = entries
                        ? entries.reduce((s, e) => s + e.amount, 0)
                        : 0;
                      const hasData = total > 0;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => hasData && setDayDetailDate(dateStr)}
                          className={`aspect-square rounded-lg px-1.5 text-center transition ${
                            hasData
                              ? "bg-neutral-100 font-medium text-neutral-800 hover:bg-neutral-200 hover:ring-2 hover:ring-neutral-300"
                              : "text-neutral-400"
                          }`}
                        >
                          <div className="text-[15px]">{day}</div>
                          {hasData && (
                            <div className="mt-1 truncate text-[13px] font-semibold text-neutral-700">
                              {formatNum(total)}원
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">
                    지출이 있는 날을 누르면 해당 날짜 상세가 열려요.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* 내보내기 (엑셀) 모달 */}
      {showExportModal && (
        <div
          className="fixed inset-0 z-50 flex h-screen items-center justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setShowExportModal(false)}
        >
          <div
            className="my-auto w-full max-w-md shrink-0 rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-neutral-900">가계부 엑셀 내보내기</h3>
            <p className="mt-1 text-sm text-neutral-500">
              연도와 범위를 선택한 뒤 내보내기를 누르세요.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500">연도</label>
                <select
                  value={exportYear}
                  onChange={(e) => setExportYear(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="block text-xs font-medium text-neutral-500">내보내기 범위</span>
                <div className="mt-2 flex flex-wrap gap-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="exportRange"
                      checked={exportRange === "year"}
                      onChange={() => setExportRange("year")}
                      className="text-neutral-700"
                    />
                    <span className="text-sm">해당 연도 전체</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="exportRange"
                      checked={exportRange === "month"}
                      onChange={() => setExportRange("month")}
                      className="text-neutral-700"
                    />
                    <span className="text-sm">특정 월</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="exportRange"
                      checked={exportRange === "months"}
                      onChange={() => setExportRange("months")}
                      className="text-neutral-700"
                    />
                    <span className="text-sm">여러 월</span>
                  </label>
                </div>
              </div>
              {exportRange === "month" && (
                <div>
                  <label className="block text-xs font-medium text-neutral-500">월</label>
                  <select
                    value={exportMonth}
                    onChange={(e) => setExportMonth(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                  >
                    {months.map((m) => (
                      <option key={m} value={m}>{m}월</option>
                    ))}
                  </select>
                </div>
              )}
              {exportRange === "months" && (
                <div>
                  <span className="block text-xs font-medium text-neutral-500">월 (복수 선택)</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {months.map((m) => (
                      <label
                        key={m}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
                      >
                        <input
                          type="checkbox"
                          checked={exportMonths.includes(m)}
                          onChange={() => toggleExportMonth(m)}
                          className="rounded text-neutral-700"
                        />
                        <span>{m}월</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-sm text-neutral-600">
                <strong>{getEntriesForExport().length}</strong>건 내보내기
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-300"
              >
                취소
              </button>
              <button
                type="button"
                onClick={runExportExcel}
                className="rounded-xl bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
              >
                엑셀 내보내기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 날짜별 상세 모달 (달력 셀 클릭) */}
      {dayDetailDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            setDayDetailDate(null);
            setDayDetailEditingId(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-neutral-900">
              {formatDateLabel(dayDetailDate)}
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              {formatNum(
                (viewMonthByDay[dayDetailDate] ?? []).reduce((s, e) => s + e.amount, 0)
              )}
              원
            </p>
            <ul className="mt-4 space-y-2">
              {(viewMonthByDay[dayDetailDate] ?? []).map((e) => {
                const cat = getCategoryForEntry(e.item, keywordsForViewMonth);
                const isEditing = dayDetailEditingId === e.id;
                return (
                  <li
                    key={e.id}
                    className="rounded-xl border border-neutral-200 bg-neutral-50/50 px-4 py-2.5 text-sm"
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={dayDetailEditItem}
                          onChange={(ev) => setDayDetailEditItem(ev.target.value)}
                          placeholder="항목"
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-800"
                        />
                        <input
                          type="number"
                          min={1}
                          value={dayDetailEditAmount}
                          onChange={(ev) => setDayDetailEditAmount(ev.target.value)}
                          placeholder="금액"
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-neutral-800"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const amount = Number(String(dayDetailEditAmount).replace(/,/g, ""));
                              updateEntry(e.id, dayDetailEditItem, amount);
                              setDayDetailEditingId(null);
                            }}
                            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={() => setDayDetailEditingId(null)}
                            className="rounded-lg bg-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-300"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-neutral-800">{e.item}</span>
                          <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600">
                            {CATEGORY_LABELS[cat]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900">
                            {formatNum(e.amount)}원
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setDayDetailEditingId(e.id);
                              setDayDetailEditItem(e.item);
                              setDayDetailEditAmount(String(e.amount));
                            }}
                            className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEntry(e.id)}
                            className="text-neutral-400 hover:text-red-600"
                            aria-label="삭제"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setDayDetailDate(null);
                  setDayDetailEditingId(null);
                }}
                className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-300"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 카테고리별 상세 항목 모달 */}
      {categoryDetailModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCategoryDetailModal(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-neutral-900">
              {CATEGORY_LABELS[categoryDetailModal]} · {yearMonthForView} 상세
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              항목별 내역이에요.
            </p>
            <div className="mt-3 rounded-xl bg-slate-100 px-4 py-3">
              <span className="text-sm font-medium text-neutral-600">총합</span>
              <span className="ml-2 text-xl font-semibold text-neutral-900">
                {formatNum(viewMonthByCategory[categoryDetailModal])}원
              </span>
            </div>
            <div className="mt-4 space-y-4">
              {Object.keys(viewMonthByCategoryDetail[categoryDetailModal]).length === 0 ? (
                <p className="text-sm text-neutral-400">해당 카테고리 내역이 없어요.</p>
              ) : (
                Object.entries(viewMonthByCategoryDetail[categoryDetailModal])
                  .sort(([, a], [, b]) => b.total - a.total)
                  .map(([itemName, { total, entries }]) => (
                    <div
                      key={itemName}
                      className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-neutral-900">{itemName}</span>
                        <span className="text-lg font-semibold text-neutral-900">
                          {formatNum(total)}원
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1.5 pl-0 text-sm text-neutral-600">
                        {entries.map(({ date, amount }, i) => (
                          <li
                            key={`${date}-${i}`}
                            className="flex justify-between rounded-lg bg-white px-3 py-1.5"
                          >
                            <span>{formatDateLabel(date)}</span>
                            <span className="font-medium">{formatNum(amount)}원</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setCategoryDetailModal(null)}
                className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-300"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 키워드 관리 모달 */}
      {showKeywordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            setShowKeywordModal(false);
            setAddKeywordCategory(null);
            setAddKeywordValue("");
            setPendingKeyword(null);
          }}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-neutral-900">카테고리 키워드 관리</h3>
            <p className="mt-1 text-sm text-neutral-500">
              항목명에 포함된 키워드로 자동 분류돼요. 키워드는 추가·삭제할 수 있어요.
            </p>
            <div className="mt-4 space-y-4">
              {(Object.keys(CATEGORY_LABELS) as CategoryId[]).map((cat) => {
                const ym = toYearMonth(todayStr());
                const { base, extra, all } = getKeywordsForCategoryInMonth(cat, ym);
                return (
                  <div key={cat} className="rounded-xl border border-neutral-200 p-4">
                    <div className="font-medium text-neutral-800">{CATEGORY_LABELS[cat]}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {base.map((w) => (
                        <span
                          key={w}
                          className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700"
                        >
                          {w}
                          <button
                            type="button"
                            onClick={() => removeKeyword(cat, w, false)}
                            className="text-neutral-400 hover:text-red-600"
                            aria-label={`${w} 삭제`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {extra.map((w) => (
                        <span
                          key={`extra-${w}`}
                          className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
                        >
                          {w} (이번 달)
                          <button
                            type="button"
                            onClick={() => removeKeyword(cat, w, true)}
                            className="text-amber-600 hover:text-red-600"
                            aria-label={`${w} 삭제`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    {addKeywordCategory === cat ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={addKeywordValue}
                          onChange={(e) => setAddKeywordValue(e.target.value)}
                          placeholder="새 키워드"
                          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm"
                          autoFocus
                        />
                        {pendingKeyword?.cat === cat && pendingKeyword?.value ? (
                          <>
                            <span className="text-sm text-neutral-500">다음 달에도 유지할까요?</span>
                            <button
                              type="button"
                              onClick={() => addKeywordToCategory(cat, pendingKeyword.value, true)}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white"
                            >
                              예
                            </button>
                            <button
                              type="button"
                              onClick={() => addKeywordToCategory(cat, pendingKeyword.value, false)}
                              className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm text-white"
                            >
                              이번 달만
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (addKeywordValue.trim())
                                setPendingKeyword({ cat, value: addKeywordValue.trim() });
                            }}
                            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm text-white"
                          >
                            추가
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setAddKeywordCategory(null);
                            setAddKeywordValue("");
                            setPendingKeyword(null);
                          }}
                          className="text-sm text-neutral-500 hover:text-neutral-700"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddKeywordCategory(cat)}
                        className="mt-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
                      >
                        + 키워드 추가
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowKeywordModal(false);
                  setAddKeywordCategory(null);
                  setAddKeywordValue("");
                  setPendingKeyword(null);
                }}
                className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-300"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 연도별 총 매출·순수익·월평균수익 한눈에 보기 */}
      <Card className="overflow-hidden">
        <h2 className="text-lg font-semibold text-neutral-900">
          연도별 총 매출 · 순수익 · 월평균수익
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          수입 데이터와 연도별 총 지출을 반영해요.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80">
                <th className="px-4 py-3 font-semibold text-neutral-700">연도</th>
                <th className="px-4 py-3 font-semibold text-neutral-700 text-right">총 매출</th>
                <th className="px-4 py-3 font-semibold text-neutral-700 text-right">총 지출</th>
                <th className="px-4 py-3 font-semibold text-neutral-700 text-right">순수익</th>
                <th className="px-4 py-3 font-semibold text-neutral-700 text-right">월평균수익</th>
              </tr>
            </thead>
            <tbody>
              {yearlySummary.map((row) => (
                <tr
                  key={row.year}
                  className="border-b border-neutral-100 transition hover:bg-neutral-50/50"
                >
                  <td className="px-4 py-3 font-medium text-neutral-800">{row.year}년</td>
                  <td className="px-4 py-3 text-right text-neutral-700">
                    {formatNum(row.매출)}원
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-700">
                    {formatNum(row.지출)}원
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${row.순수익 >= 0 ? "text-neutral-900" : "text-red-600"}`}
                  >
                    {formatNum(row.순수익)}원
                  </td>
                  <td
                    className={`px-4 py-3 text-right ${row.월평균수익 >= 0 ? "text-neutral-700" : "text-red-600"}`}
                  >
                    {formatNum(Math.round(row.월평균수익))}원
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
