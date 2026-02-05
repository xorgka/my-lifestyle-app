"use client";

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
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
  SEED_BUDGET_2024_TAX,
  SEED_BUDGET_2025_TAX,
  isExcludedFromMonthTotal,
  insertEntry,
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

/** 연도별 통계용: 만원 단위로 표시 (예: 60414405 → 6041만원) */
function formatManwon(n: number): string {
  return `${Math.round(n / 10000).toLocaleString("ko-KR")}만원`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const week = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${m}월 ${day}일 (${week})`;
}

/** "강아지 (병원)", "강아지 (사료)" → "강아지"로 묶어 total·entries 합침 */
function groupByBaseName(detail: Record<string, { total: number; entries: { date: string; amount: number }[] }>): Record<string, { total: number; entries: { date: string; amount: number }[] }> {
  const result: Record<string, { total: number; entries: { date: string; amount: number }[] }> = {};
  for (const [itemName, data] of Object.entries(detail)) {
    const baseName = itemName.includes(" (") ? itemName.slice(0, itemName.indexOf(" (")) : itemName;
    if (!result[baseName]) result[baseName] = { total: 0, entries: [] };
    result[baseName].total += data.total;
    result[baseName].entries.push(...data.entries);
  }
  for (const key of Object.keys(result)) {
    result[key].entries.sort((a, b) => a.date.localeCompare(b.date));
  }
  return result;
}

type ViewMode = "thisMonth" | "yearMonth" | "custom";

/** iframe 안에 input을 넣어 문서를 lang=ko로 고정 → 한글 IME 유지 시도 */
const ITEM_IFRAME_SRCDOC = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"></head><body style="margin:0;padding:0"><input type="text" id="item" lang="ko" autocomplete="off" placeholder="예: 배달, 악사보험, GPT" style="width:100%;padding:8px 12px;border:none;border-radius:0;font-size:14px;box-sizing:border-box;outline:none" /></body></html>`;

const ItemInput = memo(function ItemInput({
  iframeRef,
  onEnterKey,
}: {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onEnterKey?: () => void;
}) {
  const iframeLoaded = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    const input = doc?.getElementById("item") as HTMLInputElement | null;
    if (!input) return;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onEnterKey?.();
      }
    });
  }, [iframeRef, onEnterKey]);

  return (
    <div className="relative min-w-[180px]">
      <label className="text-xs font-medium text-neutral-500">항목</label>
      <iframe
        ref={iframeRef}
        title="항목 입력"
        srcDoc={ITEM_IFRAME_SRCDOC}
        onLoad={iframeLoaded}
        className="mt-1 block h-[42px] w-full overflow-hidden rounded-lg border border-neutral-200 bg-white"
        sandbox="allow-same-origin"
      />
    </div>
  );
});

export default function FinancePage() {
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [keywords, setKeywords] = useState<CategoryKeywords>(DEFAULT_KEYWORDS);
  const [monthExtras, setMonthExtras] = useState<MonthExtraKeywords>({});
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [viewMode, setViewMode] = useState<ViewMode>("thisMonth");
  const [yearMonthSelect, setYearMonthSelect] = useState(new Date().getMonth() + 1);
  const [customYear, setCustomYear] = useState(new Date().getFullYear());
  const [customMonth, setCustomMonth] = useState(new Date().getMonth() + 1);
  const [periodDropdown, setPeriodDropdown] = useState<"yearMonth" | "custom" | null>(null);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const [newItem, setNewItem] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [showKeywordModal, setShowKeywordModal] = useState(false);
  const [addKeywordCategory, setAddKeywordCategory] = useState<CategoryId | null>(null);
  const [addKeywordValue, setAddKeywordValue] = useState("");
  const [addKeywordPersist, setAddKeywordPersist] = useState<boolean | null>(null);
  const [pendingKeyword, setPendingKeyword] = useState<{ cat: CategoryId; value: string } | null>(null);
  const [categoryDetailModal, setCategoryDetailModal] = useState<CategoryId | null>(null);
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [exportRange, setExportRange] = useState<"year" | "month" | "months">("year");
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
  const [exportMonths, setExportMonths] = useState<number[]>([]);
  const [dayDetailEditingId, setDayDetailEditingId] = useState<string | null>(null);
  const [dayDetailEditItem, setDayDetailEditItem] = useState("");
  const [dayDetailEditAmount, setDayDetailEditAmount] = useState("");
  const [expandedDetailItems, setExpandedDetailItems] = useState<Set<string>>(new Set());
  const itemInputRef = useRef<HTMLIFrameElement>(null);
  const isAddingRef = useRef(false);
  const addEntryRef = useRef<() => void>(() => {});
  const [isAdding, setIsAdding] = useState(false);

  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);

  const [budgetLoading, setBudgetLoading] = useState(true);
  const load = useCallback(async () => {
    setBudgetLoading(true);
    try {
      const [e, k, m] = await Promise.all([
        loadEntries(),
        loadKeywords(),
        loadMonthExtras(),
      ]);
      setEntries(Array.isArray(e) ? e : []);
      setKeywords(k);
      setMonthExtras(m);
      setIncomeEntries(loadIncomeEntries());
    } finally {
      setBudgetLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (categoryDetailModal) setExpandedDetailItems(new Set());
  }, [categoryDetailModal]);

  const yearMonthForView = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    if (viewMode === "thisMonth") return `${y}-${String(m).padStart(2, "0")}`;
    if (viewMode === "yearMonth")
      return `${y}-${String(yearMonthSelect).padStart(2, "0")}`;
    if (viewMode === "custom")
      return `${customYear}-${String(customMonth).padStart(2, "0")}`;
    return toYearMonth(todayStr());
  }, [viewMode, yearMonthSelect, customYear, customMonth]);

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

  useEffect(() => {
    if (periodDropdown == null) return;
    const handleClick = (e: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(e.target as Node)) {
        setPeriodDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [periodDropdown]);

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
      기타: 0,
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
      기타: {},
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
    if (isAddingRef.current) return;
    const inputEl = itemInputRef.current?.contentDocument?.getElementById("item") as HTMLInputElement | null;
    const item = (inputEl?.value ?? newItem).trim();
    const amount = Number(String(newAmount).replace(/,/g, ""));
    if (!item || !Number.isFinite(amount) || amount <= 0) return;
    isAddingRef.current = true;
    setIsAdding(true);
    const id = `e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newEntry: BudgetEntry = { id, date: selectedDate, item, amount };
    setNewItem("");
    setNewAmount("");
    insertEntry(newEntry)
      .then((saved) => setEntries((prev) => [...prev, saved]))
      .catch((err) => {
        console.error("가계부 저장 실패", err);
        alert("저장에 실패했습니다. 브라우저 콘솔(F12)을 확인하거나, Supabase 대시보드에서 budget_entries 테이블 RLS 정책을 확인해 주세요.");
      })
      .finally(() => {
        isAddingRef.current = false;
        setIsAdding(false);
        const iframe = itemInputRef.current;
        const input = iframe?.contentDocument?.getElementById("item") as HTMLInputElement | null;
        if (iframe && input) {
          // iframe → 입력란 순으로 포커스한 뒤, 다음 프레임에 값 비움 (프로그래밍 포커스 시 IME 초기화 완화)
          iframe.focus();
          input.focus();
          requestAnimationFrame(() => {
            input.value = "";
          });
        }
      });
  };

  useEffect(() => {
    addEntryRef.current = addEntry;
  });

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

  /** 연도별 총 지출: 21~25 고정값, 2026년~ 가계부 입력 합계 */
  const FIXED_TOTAL_EXPENSE: Record<number, number> = {
    2021: 54_188_966,
    2022: 55_234_232,
    2023: 78_522_191,
    2024: 50_312_782,
    2025: 62_880_691,
  };

  /** 21~23년 사업 및 경비 고정값 (연도별 통계 순수익용, 수입 페이지 시드와 동일) */
  const FIXED_BUSINESS_EXPENSE: Record<number, number> = {
    2021: 1_898_110,
    2022: 4_944_380,
    2023: 17_374_210,
  };

  const seed2024Business = useMemo(() => SEED_BUDGET_2024_TAX.reduce((s, e) => s + e.amount, 0), []);
  const seed2025Business = useMemo(() => SEED_BUDGET_2025_TAX.reduce((s, e) => s + e.amount, 0), []);

  /** 연도별 통계. 총 지출 = 위 고정값 표시용. 순수익 = 매출 - 사업 및 경비 (21~23 고정값, 24·25 시드, 2026+ 세금·사업경비만) */
  const yearlySummary = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearList = Array.from({ length: currentYear - 2020 }, (_, i) => 2021 + i);
    return yearList.map((y) => {
      const yNum = Number(y);
      const 매출 = incomeEntries.filter((e) => e.year === yNum).reduce((s, e) => s + e.amount, 0);
      const 지출표시값 =
        FIXED_TOTAL_EXPENSE[yNum] ??
        (yNum >= 2026
          ? entries.filter((e) => e.date.startsWith(String(yNum))).reduce((s, e) => s + e.amount, 0)
          : null);
      const 지출데이터있음 = 지출표시값 != null;
      const 지출 = 지출표시값 ?? 0;
      let 사업및경비: number | null = null;
      if (FIXED_BUSINESS_EXPENSE[yNum] != null) {
        사업및경비 = FIXED_BUSINESS_EXPENSE[yNum];
      } else if (yNum === 2024) {
        사업및경비 = seed2024Business;
      } else if (yNum === 2025) {
        사업및경비 = seed2025Business;
      } else if (yNum >= 2026) {
        사업및경비 = entries
          .filter((e) => e.date.startsWith(String(yNum)))
          .filter((e) => {
            const kw = getKeywordsForMonth(keywords, monthExtras, toYearMonth(e.date));
            const cat = getCategoryForEntry(e.item, kw);
            return cat === "세금" || cat === "사업경비";
          })
          .reduce((s, e) => s + e.amount, 0);
      }
      const 순수익: number | null =
        사업및경비 != null ? 매출 - 사업및경비 : null;
      const 월평균수익 = 순수익 != null && 12 > 0 ? 순수익 / 12 : 0;
      return { year: yNum, 매출, 지출, 지출데이터있음, 순수익, 월평균수익 };
    });
  }, [incomeEntries, entries, keywords, monthExtras, seed2024Business, seed2025Business]);

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
          날짜를 선택한 뒤 항목과 금액을 입력하세요. 항목명에 따라 고정비·사업경비·생활비·신용카드·기타로 자동 분류돼요.
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
          <button
            type="button"
            onClick={() => {
              const d = new Date(selectedDate + "T12:00:00");
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().slice(0, 10));
            }}
            className="flex h-[42px] items-center rounded-lg border border-neutral-200 bg-white px-3 text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
            title="다음 날"
            aria-label="다음 날"
          >
            <span className="text-lg">→</span>
          </button>
          <ItemInput iframeRef={itemInputRef} onEnterKey={() => addEntryRef.current()} />
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
            disabled={isAdding}
            className="rounded-xl bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:pointer-events-none disabled:opacity-60"
          >
            {isAdding ? "저장 중…" : "추가"}
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

      {/* 보기: 이번달(고정) / 올해(1~12월 드롭다운) / 특정 연·월(연·월 드롭다운) */}
      <Card>
        <h2 className="text-lg font-semibold text-neutral-900">기간별 보기</h2>
        <div ref={periodDropdownRef} className="mt-3 mb-8 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("thisMonth")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              viewMode === "thisMonth"
                ? "bg-neutral-800 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            이번달
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setViewMode("yearMonth");
                setPeriodDropdown((d) => (d === "yearMonth" ? null : "yearMonth"));
              }}
              className={`flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
                viewMode === "yearMonth"
                  ? "bg-neutral-800 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              올해
              <span className="text-[10px] opacity-80">▼</span>
            </button>
            {periodDropdown === "yearMonth" && (
              <div className="absolute left-0 top-full z-10 mt-1 min-w-[100px] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
                {months.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setYearMonthSelect(m);
                      setViewMode("yearMonth");
                      setPeriodDropdown(null);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-neutral-100"
                  >
                    {m}월
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setViewMode("custom");
                setPeriodDropdown((d) => (d === "custom" ? null : "custom"));
              }}
              className={`flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
                viewMode === "custom"
                  ? "bg-neutral-800 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              특정 연·월
              <span className="text-[10px] opacity-80">▼</span>
            </button>
            {periodDropdown === "custom" && (
              <div className="absolute left-0 top-full z-10 mt-1 flex gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg">
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
          </div>
        </div>

        {(viewMode === "thisMonth" || viewMode === "yearMonth" || viewMode === "custom") && (
          <div className="mt-4 space-y-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-2xl font-semibold text-neutral-900">
                <span>
                  {parseInt(yearMonthForView.split("-")[1], 10)}월 지출: {formatNum(viewMonthTotalDisplay)}원
                </span>
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
          onClick={() => {
            setCategoryDetailModal(null);
            setExpandedDetailItems(new Set());
          }}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-neutral-900">
              {CATEGORY_LABELS[categoryDetailModal]} · {yearMonthForView} 상세
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              항목별 내역이에요. 날짜별 세부는 펼쳐서 볼 수 있어요.
            </p>
            <div className="mt-3 rounded-xl bg-slate-100 px-4 py-3">
              <span className="text-sm font-medium text-neutral-600">총합</span>
              <span className="ml-2 text-xl font-semibold text-neutral-900">
                {formatNum(viewMonthByCategory[categoryDetailModal])}원
              </span>
            </div>
            <div className="mt-4 space-y-4">
              {(() => {
                const rawDetail = viewMonthByCategoryDetail[categoryDetailModal];
                const grouped = groupByBaseName(rawDetail);
                return Object.keys(grouped).length === 0 ? (
                  <p className="text-sm text-neutral-400">해당 카테고리 내역이 없어요.</p>
                ) : (
                Object.entries(grouped)
                  .sort(([, a], [, b]) => b.total - a.total)
                  .map(([itemName, { total, entries }]) => {
                    const isExpanded = expandedDetailItems.has(itemName);
                    return (
                      <div
                        key={itemName}
                        className="rounded-xl border border-neutral-200 bg-neutral-50/50 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDetailItems((prev) => {
                              const next = new Set(prev);
                              if (next.has(itemName)) next.delete(itemName);
                              else next.add(itemName);
                              return next;
                            })
                          }
                          className="flex w-full items-center justify-between p-4 text-left hover:bg-neutral-100/80 transition-colors"
                        >
                          <span className="font-semibold text-neutral-900">{itemName} ({entries.length})</span>
                          <span className="flex items-center gap-2">
                            <span className="text-lg font-semibold text-neutral-900">
                              {formatNum(total)}원
                            </span>
                            <span
                              className={`text-neutral-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              aria-hidden
                            >
                              ▼
                            </span>
                          </span>
                        </button>
                        {isExpanded && (
                          <ul className="border-t border-neutral-200 space-y-1.5 px-4 pb-4 pt-2 pl-0 text-sm text-neutral-600">
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
                        )}
                      </div>
                    );
                  })
                );
              })()}
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
          className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4"
          onClick={() => {
            setShowKeywordModal(false);
            setAddKeywordCategory(null);
            setAddKeywordValue("");
            setPendingKeyword(null);
          }}
        >
          <div className="flex min-h-[100dvh] items-center justify-center py-8">
            <div
              className="my-auto max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
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
        </div>
      )}

      {/* 연도별 통계 */}
      <Card className="overflow-hidden">
        <h2 className="text-lg font-semibold text-neutral-900">연도별 통계</h2>
        <p className="mt-1 text-sm text-neutral-500">
          수입 데이터와 연도별 총 지출을 반영해요.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80">
                <th className="px-4 py-3 font-semibold text-neutral-700">연도</th>
                <th className="px-4 py-3 font-semibold text-neutral-700 text-right">총 매출</th>
                <th className="px-4 py-3 font-semibold text-neutral-700 text-right">순수익</th>
                <th className="px-4 py-3 font-semibold text-neutral-700 text-right">총 지출</th>
                <th className="px-4 py-3 font-semibold text-neutral-700 text-right">저축</th>
                <th className="px-4 py-3 font-semibold text-neutral-700 text-right">월평균수익</th>
              </tr>
            </thead>
            <tbody>
              {yearlySummary.map((row) => {
                const 순수익있음 = row.순수익 != null;
                const 저축값 = row.지출데이터있음 && 순수익있음 ? row.순수익! - row.지출 : null;
                const 순수익표시 = !순수익있음 ? "데이터 없음" : formatManwon(row.순수익!);
                return (
                  <tr
                    key={row.year}
                    className="border-b border-neutral-100 transition hover:bg-neutral-50/50"
                  >
                    <td className="px-4 py-3 font-medium text-neutral-800">{row.year}년</td>
                    <td className="px-4 py-3 text-right text-neutral-700">
                      {formatManwon(row.매출)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${!순수익있음 ? "text-neutral-500" : row.순수익! >= 0 ? "text-blue-600" : "text-red-600"}`}
                    >
                      {순수익표시}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">
                      {row.지출데이터있음 ? formatManwon(row.지출) : "데이터 없음"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${저축값 !== null ? (저축값 >= 0 ? "text-blue-600" : "text-red-600") : "text-neutral-500"}`}
                    >
                      {저축값 !== null ? formatManwon(저축값) : "데이터 없음"}
                    </td>
                    <td className={`px-4 py-3 text-right ${!순수익있음 ? "text-neutral-500" : row.월평균수익 >= 0 ? "text-blue-600" : "text-red-600"}`}>
                      {!순수익있음 ? "데이터 없음" : formatManwon(Math.round(row.월평균수익))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
