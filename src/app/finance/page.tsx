"use client";

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { createPortal } from "react-dom";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Card } from "@/components/ui/Card";
import { AmountToggle, formatAmountShort } from "@/components/ui/AmountToggle";
import {
  type BudgetEntry,
  type BudgetEntryDetail,
  type CategoryId,
  type CategoryKeywords,
  type DisplayCategoryId,
  type MonthExtraKeywords,
  CATEGORY_LABELS,
  DEFAULT_KEYWORDS,
  EXCLUDE_FROM_MONTH_TOTAL,
  getCategoryForEntry,
  getKeywordsForMonth,
  SEED_BUDGET_2024_TAX,
  SEED_BUDGET_2025_TAX,
  SEED_GLANCE_BY_YEAR,
  isExcludedFromMonthTotal,
  insertEntry,
  loadEntries,
  loadEntryDetails,
  loadKeywords,
  loadMonthExtras,
  saveEntries,
  saveEntryDetails,
  saveKeywords,
  saveMonthExtras,
  todayStr,
  toYearMonth,
} from "@/lib/budget";
import { type IncomeEntry, loadIncomeEntries } from "@/lib/income";
import { supabase } from "@/lib/supabase";
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

/** 모달 세부내역용 짧은 날짜: "2/2(목)" */
function formatDateLabelShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const week = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${m}/${day}(${week})`;
}

type DetailEntry = { date: string; amount: number; item: string };

/** "강아지 (병원)", "강아지 (사료)" → "강아지"로 묶어 total·entries 합침. entries에는 항목명(item) 유지 */
function groupByBaseName(detail: Record<string, { total: number; entries: DetailEntry[] }>): Record<string, { total: number; entries: DetailEntry[] }> {
  const result: Record<string, { total: number; entries: DetailEntry[] }> = {};
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

type ViewMode = "yearMonth" | "custom" | "yearAtGlance";

/** 항목 입력 (일반 input으로 state와 동기화해 추가 버튼이 확실히 동작) */
const ItemInput = memo(function ItemInput({
  value,
  onChange,
  onEnterKey,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnterKey?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="relative min-w-[180px]">
      <label className="text-xs font-medium text-neutral-500">항목</label>
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        lang="ko"
        autoComplete="off"
        placeholder="예: 배달, 보험, IRP, 강아지"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnterKey?.();
          }
        }}
        className="mt-1 block h-[42px] w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
      />
    </div>
  );
});

export default function FinancePage() {
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [entryDetails, setEntryDetails] = useState<BudgetEntryDetail[]>([]);
  const [keywords, setKeywords] = useState<CategoryKeywords>(DEFAULT_KEYWORDS);
  const [monthExtras, setMonthExtras] = useState<MonthExtraKeywords>({});
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [viewMode, setViewMode] = useState<ViewMode>("yearMonth");
  const [yearMonthSelect, setYearMonthSelect] = useState(new Date().getMonth() + 1);
  const [customYear, setCustomYear] = useState(2026);
  const [customMonth, setCustomMonth] = useState(new Date().getMonth() + 1);
  const [glanceYear, setGlanceYear] = useState(2026);
  const [periodDropdown, setPeriodDropdown] = useState<"yearMonth" | "custom" | null>(null);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const [newItem, setNewItem] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [showKeywordModal, setShowKeywordModal] = useState(false);
  const [addKeywordCategory, setAddKeywordCategory] = useState<CategoryId | null>(null);
  const [addKeywordValue, setAddKeywordValue] = useState("");
  const [addKeywordPersist, setAddKeywordPersist] = useState<boolean | null>(null);
  const [pendingKeyword, setPendingKeyword] = useState<{ cat: CategoryId; value: string } | null>(null);
  const [categoryDetailModal, setCategoryDetailModal] = useState<DisplayCategoryId | null>(null);
  const [showCardExpenseDetailModal, setShowCardExpenseDetailModal] = useState(false);
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  /** 검색 결과 연도 필터: 전체 | 2021~2027 */
  const [searchYearFilter, setSearchYearFilter] = useState<"all" | string>("all");
  const [showExportModal, setShowExportModal] = useState(false);
  /** 모바일: 검색·키워드 관리·내보내기 메뉴 열림 */
  const [showFinanceSettingsMenu, setShowFinanceSettingsMenu] = useState(false);
  /** PC: 기간별 보기 달력 날짜 호버 시 해당일 내역 툴팁 */
  const [calendarDayTooltip, setCalendarDayTooltip] = useState<{
    dateStr: string;
    left: number;
    top: number;
  } | null>(null);
  const [showMonthExpenseTooltip, setShowMonthExpenseTooltip] = useState(false);
  const monthExpenseTooltipHoverRef = useRef<number | null>(null);
  const now = new Date();
  const [exportYear, setExportYear] = useState(now.getFullYear());
  const [exportRange, setExportRange] = useState<"month" | "year" | "range" | "all">("year");
  const [exportMonth, setExportMonth] = useState(now.getMonth() + 1);
  const [exportRangeFrom, setExportRangeFrom] = useState(() => {
    const d = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [exportRangeTo, setExportRangeTo] = useState(() =>
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  );
  const [dayDetailEditingId, setDayDetailEditingId] = useState<string | null>(null);
  const [dayDetailEditItem, setDayDetailEditItem] = useState("");
  const [dayDetailEditAmount, setDayDetailEditAmount] = useState("");
  /** 선택한 날짜 내역 박스 더블클릭 시 인라인 수정 */
  const [listEditId, setListEditId] = useState<string | null>(null);
  /** 해당 날짜 내역에서 카드출금 세부 펼침 여부 (entry id 집합) */
  const [expandedDailyDetailIds, setExpandedDailyDetailIds] = useState<Set<string>>(new Set());
  const [listEditItem, setListEditItem] = useState("");
  const [listEditAmount, setListEditAmount] = useState("");
  const [expandedDetailItems, setExpandedDetailItems] = useState<Set<string>>(new Set());
  /** 카드지출 입력 모달 (null = 새로 추가, 있으면 수정) */
  const [showCardExpenseModal, setShowCardExpenseModal] = useState(false);
  const [cardModalEditEntry, setCardModalEditEntry] = useState<BudgetEntry | null>(null);
  const [cardModalDate, setCardModalDate] = useState("");
  const [cardModalItem, setCardModalItem] = useState("카드출금");
  const [cardModalTotal, setCardModalTotal] = useState("");
  const [cardModalDetails, setCardModalDetails] = useState<{ id: string; item: string; amount: number }[]>([]);
  const [focusNewDetailItem, setFocusNewDetailItem] = useState(false);
  const [cardExpenseApplying, setCardExpenseApplying] = useState(false);
  const [cardExpenseMessage, setCardExpenseMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);
  /** 페이지 내 카드지출 (총합+세부) 입력란 */
  const [cardSectionItem, setCardSectionItem] = useState("카드출금");
  const [cardSectionTotal, setCardSectionTotal] = useState("");
  const [cardSectionDetails, setCardSectionDetails] = useState<{ id: string; item: string; amount: number }[]>([]);
  const [cardSectionApplying, setCardSectionApplying] = useState(false);
  const [cardSectionOpen, setCardSectionOpen] = useState(false);
  const cardSectionRef = useRef<HTMLDivElement>(null);
  const lastDetailItemRef = useRef<HTMLInputElement>(null);
  const cardModalTotalRef = useRef("");
  const cardModalItemRef = useRef("카드출금");
  const cardModalDetailsRef = useRef<{ id: string; item: string; amount: number }[]>([]);
  /** 반영 클릭 시 DOM에서 직접 읽기 위해 (state/ref 틀어짐 방지) */
  const cardModalContentRef = useRef<HTMLDivElement>(null);
  const cardModalFormRef = useRef<HTMLFormElement>(null);
  const lastDetailItemInputRef = useRef<HTMLInputElement>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const isAddingRef = useRef(false);
  const addEntryRef = useRef<() => void>(() => {});
  const [isAdding, setIsAdding] = useState(false);

  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);

  const [budgetLoading, setBudgetLoading] = useState(true);
  const load = useCallback(async () => {
    setBudgetLoading(true);
    try {
      const [e, ed, k, m] = await Promise.all([
        loadEntries(),
        loadEntryDetails(),
        loadKeywords(),
        loadMonthExtras(),
      ]);
      setEntries(Array.isArray(e) ? e : []);
      setEntryDetails(Array.isArray(ed) ? ed : []);
      setKeywords(k);
      setMonthExtras(m);
      setIncomeEntries(await loadIncomeEntries());
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

  useEffect(() => {
    setListEditId(null);
  }, [selectedDate]);

  const yearMonthForView = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    if (viewMode === "yearMonth")
      return `${y}-${String(yearMonthSelect).padStart(2, "0")}`;
    if (viewMode === "custom")
      return `${customYear}-${String(customMonth).padStart(2, "0")}`;
    if (viewMode === "yearAtGlance") return `${glanceYear}-01`;
    return toYearMonth(todayStr());
  }, [viewMode, yearMonthSelect, customYear, customMonth, glanceYear]);

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

  /** 검색어가 있으면 항목명 기준으로 필터 (표시용). 본문 항목 + 카드 세부내역 항목 모두 검색 */
  const displayEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      if (e.item.toLowerCase().includes(q)) return true;
      const hasMatchingDetail = entryDetails.some(
        (d) => d.parentId === e.id && d.item.toLowerCase().includes(q)
      );
      return hasMatchingDetail;
    });
  }, [entries, entryDetails, searchQuery]);

  /** 검색 결과를 행 단위로 변환: 본문 매칭이면 1행(전체 금액), 세부 매칭이면 매칭된 세부만 각각 1행(세부 금액) */
  const searchResultRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const rows: { date: string; item: string; amount: number; rowId: string }[] = [];
    for (const e of displayEntries) {
      const mainMatches = e.item.toLowerCase().includes(q);
      const details = entryDetails.filter((d) => d.parentId === e.id);
      const matchingDetails = details.filter((d) => d.item.toLowerCase().includes(q));
      if (mainMatches) {
        rows.push({ date: e.date, item: e.item, amount: e.amount, rowId: `${e.id}-main` });
      } else {
        for (const d of matchingDetails) {
          rows.push({ date: e.date, item: d.item, amount: d.amount, rowId: `${e.id}-${d.id}` });
        }
      }
    }
    return rows;
  }, [displayEntries, entryDetails, searchQuery]);

  /** 검색 결과 행에 연도 필터 적용 */
  const filteredSearchRows = useMemo(() => {
    if (searchYearFilter === "all") return searchResultRows;
    return searchResultRows.filter((r) => r.date.startsWith(searchYearFilter));
  }, [searchResultRows, searchYearFilter]);

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
    const map: Record<DisplayCategoryId, number> = {
      고정비: 0,
      사업경비: 0,
      세금: 0,
      생활비: 0,
      기타: 0,
      미분류: 0,
    };
    viewMonthEntries.forEach((e) => {
      const details = entryDetails.filter((d) => d.parentId === e.id);
      const kw = getKeywordsForMonth(keywords, monthExtras, toYearMonth(e.date));
      if (details.length > 0) {
        const detailSum = details.reduce((s, d) => s + d.amount, 0);
        details.forEach((d) => {
          const cat = getCategoryForEntry(d.item.trim(), kw);
          map[cat] += d.amount;
        });
        const unclassified = e.amount - detailSum;
        if (unclassified > 0) map.미분류 += unclassified;
      } else {
        const cat = getCategoryForEntry(e.item, kw);
        map[cat] += e.amount;
      }
    });
    return map;
  }, [viewMonthEntries, entryDetails, keywords, monthExtras]);

  /** 한눈에 탭: 선택 연도의 1~12월 월별 지출. 22~25년은 시스템 입력(SEED_GLANCE_BY_YEAR), 26년~는 가계부 입력 반영 */
  const viewYearByMonthGlance = useMemo(() => {
    if (glanceYear >= 2021 && glanceYear <= 2025 && SEED_GLANCE_BY_YEAR[glanceYear]) {
      const byMonth = SEED_GLANCE_BY_YEAR[glanceYear];
      return { year: glanceYear, byMonth: { ...byMonth } };
    }
    const yearPrefix = String(glanceYear);
    const entriesInYear = displayEntries.filter((e) => e.date.startsWith(yearPrefix));
    const byMonth: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) byMonth[m] = 0;
    entriesInYear.forEach((e) => {
      const month = parseInt(e.date.slice(5, 7), 10);
      if (month >= 1 && month <= 12) {
        const add = isExcludedFromMonthTotal(e.item) ? 0 : e.amount;
        byMonth[month] += add;
      }
    });
    return { year: glanceYear, byMonth };
  }, [displayEntries, glanceYear]);

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

  /** 해당 월 달력 그리드: 필요한 주 수만큼만 (5주 또는 6주), 각 셀은 null 또는 { day, dateStr } */
  const viewMonthCalendar = useMemo(() => {
    const [y, m] = yearMonthForView.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const firstDayOfWeek = new Date(y, m - 1, 1).getDay();
    const totalCells = firstDayOfWeek + lastDay;
    const rowCount = Math.ceil(totalCells / 7);
    const cellCount = rowCount * 7;
    const cells: ({ day: number; dateStr: string } | null)[] = [];
    for (let i = 0; i < cellCount; i++) {
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

  const todayDateStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  /** 카테고리별 → 항목별 상세 (모달용). 세부 있으면 세부는 카테고리별, 나머지 = 미분류 */
  const viewMonthByCategoryDetail = useMemo(() => {
    const out: Record<DisplayCategoryId, Record<string, { total: number; entries: DetailEntry[] }>> = {
      고정비: {},
      사업경비: {},
      세금: {},
      생활비: {},
      기타: {},
      미분류: {},
    };
    viewMonthEntries.forEach((e) => {
      const details = entryDetails.filter((d) => d.parentId === e.id);
      const kw = getKeywordsForMonth(keywords, monthExtras, toYearMonth(e.date));
      if (details.length > 0) {
        const detailSum = details.reduce((s, d) => s + d.amount, 0);
        details.forEach((d) => {
          const cat = getCategoryForEntry(d.item.trim(), kw);
          if (!out[cat][d.item]) out[cat][d.item] = { total: 0, entries: [] };
          out[cat][d.item].total += d.amount;
          out[cat][d.item].entries.push({ date: e.date, amount: d.amount, item: d.item });
        });
        const unclassified = e.amount - detailSum;
        if (unclassified > 0) {
          const label = `${e.item} (미분류)`;
          if (!out.미분류[label]) out.미분류[label] = { total: 0, entries: [] };
          out.미분류[label].total += unclassified;
          out.미분류[label].entries.push({ date: e.date, amount: unclassified, item: label });
        }
      } else {
        const cat = getCategoryForEntry(e.item, kw);
        if (!out[cat][e.item]) out[cat][e.item] = { total: 0, entries: [] };
        out[cat][e.item].total += e.amount;
        out[cat][e.item].entries.push({ date: e.date, amount: e.amount, item: e.item });
      }
    });
    (Object.keys(out) as DisplayCategoryId[]).forEach((cat) => {
      Object.keys(out[cat]).forEach((item) => {
        out[cat][item].entries.sort((a, b) => a.date.localeCompare(b.date));
      });
    });
    return out;
  }, [viewMonthEntries, entryDetails, keywords, monthExtras]);

  /** 기간별 보기: 해당 월 카드출금(세부 있는 건) 총합·세부·미분류 한눈에 */
  const viewMonthCardExpenseSummary = useMemo(() => {
    const cardEntries = viewMonthEntries.filter((e) =>
      entryDetails.some((d) => d.parentId === e.id)
    );
    let total = 0;
    let detailTotal = 0;
    const rows: { entry: BudgetEntry; details: BudgetEntryDetail[]; unclassified: number }[] = [];
    cardEntries.forEach((e) => {
      const details = entryDetails.filter((d) => d.parentId === e.id);
      const detailSum = details.reduce((s, d) => s + d.amount, 0);
      const unclassified = e.amount - detailSum;
      total += e.amount;
      detailTotal += detailSum;
      rows.push({ entry: e, details, unclassified });
    });
    const unclassifiedTotal = total - detailTotal;
    return { total, detailTotal, unclassifiedTotal, rows };
  }, [viewMonthEntries, entryDetails]);

  /** 지출 한 건 추가 (일반 추가 / 카드지출 반영 둘 다 이 함수만 사용). onDone은 카드지출 모달 닫기용 */
  const addOneEntry = (entry: BudgetEntry, onDone?: () => void) => {
    setEntries((prev) => [...prev, entry]);
    insertEntry(entry)
      .then((saved) => {
        if (saved.id !== entry.id) {
          setEntries((prev) => prev.map((e) => (e.id === entry.id ? saved : e)));
        }
        onDone?.();
      })
      .catch((err) => {
        console.error("가계부 저장 실패", err);
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        alert("저장에 실패했습니다. F12 콘솔 확인.");
      });
  };

  const addEntry = () => {
    if (isAddingRef.current) return;
    const item = (itemInputRef.current?.value ?? newItem).toString().trim();
    const amountRaw = (amountInputRef.current?.value ?? newAmount).toString().replace(/,/g, "");
    const amount = Number(amountRaw) || 0;
    if (!item || !Number.isFinite(amount) || amount <= 0) return;
    isAddingRef.current = true;
    setIsAdding(true);
    const id = `e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newEntry: BudgetEntry = { id, date: selectedDate, item, amount };
    setNewItem("");
    setNewAmount("");
    addOneEntry(newEntry);
    isAddingRef.current = false;
    setIsAdding(false);
    itemInputRef.current?.focus();
  };

  useEffect(() => {
    addEntryRef.current = addEntry;
  });

  const removeEntry = (id: string) => {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    const nextDetails = entryDetails.filter((d) => d.parentId !== id);
    setEntryDetails(nextDetails);
    saveEntries(next)
      .then((updated) => setEntries(updated))
      .then(() => saveEntryDetails(nextDetails))
      .then((saved) => setEntryDetails(saved))
      .catch((err) => {
        console.error(err);
        load();
      });
  };

  const updateEntry = (id: string, item: string, amount: number, date?: string) => {
    const trimmed = item.trim();
    if (!trimmed || !Number.isFinite(amount) || amount <= 0) return;
    const next = entries.map((e) =>
      e.id === id
        ? { ...e, item: trimmed, amount, ...(date != null && date !== "" ? { date } : {}) }
        : e
    );
    setEntries(next);
    saveEntries(next)
      .then((updated) => setEntries(updated))
      .catch((err) => {
        console.error(err);
        load();
      });
  };

  const openCardExpenseModal = (editEntry?: BudgetEntry) => {
    setCardExpenseMessage(null);
    if (editEntry) {
      setCardModalEditEntry(editEntry);
      setCardModalDate(editEntry.date);
      setCardModalItem(editEntry.item);
      setCardModalTotal(String(editEntry.amount));
      setCardModalDetails(
        entryDetails
          .filter((d) => d.parentId === editEntry.id)
          .map((d) => ({ id: d.id, item: d.item, amount: d.amount }))
      );
      cardModalTotalRef.current = String(editEntry.amount);
      cardModalItemRef.current = editEntry.item;
      cardModalDetailsRef.current = entryDetails
          .filter((d) => d.parentId === editEntry.id)
          .map((d) => ({ id: d.id, item: d.item, amount: d.amount }));
      setFocusNewDetailItem(false);
      setShowCardExpenseModal(true);
    } else {
      setCardSectionOpen(true);
      setTimeout(() => cardSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  };

  useEffect(() => {
    cardModalTotalRef.current = cardModalTotal;
    cardModalItemRef.current = cardModalItem;
    cardModalDetailsRef.current = cardModalDetails;
  }, [cardModalTotal, cardModalItem, cardModalDetails]);

  useEffect(() => {
    if (focusNewDetailItem && lastDetailItemInputRef.current) {
      lastDetailItemInputRef.current.focus();
      setFocusNewDetailItem(false);
    }
  }, [focusNewDetailItem, cardModalDetails.length]);

  const addCardModalDetailRow = (focusItem = false) => {
    const newRow = { id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, item: "", amount: 0 };
    setCardModalDetails((prev) => {
      const next = [...prev, newRow];
      cardModalDetailsRef.current = next;
      return next;
    });
    if (focusItem) setFocusNewDetailItem(true);
  };

  const updateCardModalDetailRow = (rowId: string, field: "item" | "amount", value: string | number) => {
    setCardModalDetails((prev) => {
      const next = prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              [field]:
                field === "amount"
                  ? (typeof value === "number" ? value : Number(String(value).replace(/,/g, "")) || 0)
                  : value,
            }
          : r
      );
      cardModalDetailsRef.current = next;
      return next;
    });
  };

  const removeCardModalDetailRow = (rowId: string) => {
    setCardModalDetails((prev) => {
      const next = prev.filter((r) => r.id !== rowId);
      cardModalDetailsRef.current = next;
      return next;
    });
  };

  /** 카드지출 반영 = 일반지출 추가와 완전히 동일하게 addOneEntry(한 건) 호출 */
  const applyCardExpense = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setCardExpenseMessage(null);

    const item = ((cardModalItemRef.current ?? cardModalItem) || "").toString().trim() || "카드출금";
    const totalStr = (cardModalTotalRef.current ?? cardModalTotal).toString().replace(/,/g, "");
    const amount = Number(totalStr) || 0;
    if (!Number.isFinite(amount) || amount <= 0) {
      setCardExpenseMessage({ type: "error", text: "카드 총합(원)에 숫자를 입력해 주세요. (입력값: " + (totalStr || "비어있음") + ")" });
      return;
    }

    if (cardModalEditEntry) {
      setCardExpenseApplying(true);
      updateEntry(cardModalEditEntry.id, item, amount, cardModalDate.trim() || undefined);
      const others = entryDetails.filter((d) => d.parentId !== cardModalEditEntry.id);
      const validDetails = cardModalDetails.filter(
        (r) => String(r.item || "").trim() && Number.isFinite(Number(r.amount)) && Number(r.amount) > 0
      );
      const nextDetails: BudgetEntryDetail[] = [
        ...others,
        ...validDetails.map((r) => ({
          id: r.id,
          parentId: cardModalEditEntry.id,
          item: String(r.item).trim(),
          amount: Number(r.amount),
        })),
      ];
      saveEntryDetails(nextDetails)
        .then((saved) => {
          setEntryDetails(saved);
          setShowCardExpenseModal(false);
          setCardModalEditEntry(null);
          setCardModalDate("");
          setCardModalTotal("");
          setCardModalDetails([]);
        })
        .catch((err) => {
          console.error("카드지출 세부 저장 실패", err);
          setCardExpenseMessage({ type: "error", text: "저장 실패." });
        })
        .finally(() => setCardExpenseApplying(false));
      return;
    }

    // 새 카드지출: 목록에 먼저 넣고 모달 닫은 뒤, insertEntry (일반 추가와 동일)
    const id = `e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newEntry: BudgetEntry = { id, date: selectedDate, item, amount };
    setEntries((prev) => [...prev, newEntry]);
    setShowCardExpenseModal(false);
    setCardModalTotal("");
    setCardModalDetails([]);
    insertEntry(newEntry)
      .then((saved) => {
        if (saved.id !== newEntry.id) {
          setEntries((prev) => prev.map((e) => (e.id === newEntry.id ? saved : e)));
        }
      })
      .catch((err) => {
        console.error("가계부 저장 실패", err);
        setEntries((prev) => prev.filter((e) => e.id !== newEntry.id));
        alert("저장 실패. F12 콘솔 확인.");
      });
  };

  /** 페이지 내 카드지출(총합+세부) 반영: 부모 1건 + 세부 N건 저장, 남은 금액 = 미분류 */
  const applyCardSection = () => {
    const item = (cardSectionItem || "").trim() || "카드출금";
    const total = Number(String(cardSectionTotal).replace(/,/g, "")) || 0;
    const validDetails = cardSectionDetails.filter(
      (r) => String(r.item || "").trim() && Number.isFinite(Number(r.amount)) && Number(r.amount) > 0
    );
    const detailSum = validDetails.reduce((s, r) => s + Number(r.amount), 0);
    if (total <= 0) {
      alert("카드 총합(원)에 숫자를 입력해 주세요.");
      return;
    }
    if (detailSum > total) {
      alert(`세부 합계(${formatNum(detailSum)}원)가 카드 총합(${formatNum(total)}원)을 넘을 수 없어요.`);
      return;
    }
    setCardSectionApplying(true);
    const parentId = `e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newEntry: BudgetEntry = { id: parentId, date: selectedDate, item, amount: total };
    setEntries((prev) => [...prev, newEntry]);
    insertEntry(newEntry)
      .then((saved) => {
        if (saved.id !== parentId) {
          setEntries((prev) => prev.map((e) => (e.id === parentId ? saved : e)));
        }
        const finalParentId = saved.id;
        const newDetailRows: BudgetEntryDetail[] = validDetails.map((r) => ({
          id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          parentId: finalParentId,
          item: String(r.item).trim(),
          amount: Number(r.amount),
        }));
        return saveEntryDetails([...entryDetails, ...newDetailRows]);
      })
      .then((savedDetails) => {
        setEntryDetails(savedDetails);
        setCardSectionTotal("");
        setCardSectionDetails([]);
      })
      .catch((err) => {
        console.error("카드지출 저장 실패", err);
        setEntries((prev) => prev.filter((e) => e.id !== parentId));
        alert("저장 실패. F12 콘솔 확인.");
      })
      .finally(() => setCardSectionApplying(false));
  };

  const addCardSectionDetailRow = () => {
    setCardSectionDetails((prev) => [
      ...prev,
      { id: `row-${Date.now()}`, item: "", amount: 0 },
    ]);
    setTimeout(() => lastDetailItemRef.current?.focus(), 50);
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
      // 한 키워드는 한 카테고리에만 속하도록: 다른 카테고리에서는 제거 (고정비↔세금 이동 등)
      const categoryIds = Object.keys(keywords) as CategoryId[];
      const nextKeywords: CategoryKeywords = { ...keywords };
      for (const c of categoryIds) {
        if (c === cat) nextKeywords[c] = [...(nextKeywords[c] ?? []), w];
        else nextKeywords[c] = (nextKeywords[c] ?? []).filter((x) => x !== w);
      }
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

  /** 내보내기 연도: 2026년부터 올해까지 (올해가 2026이면 [2026], 2027이면 [2026, 2027] …) */
  const years = useMemo(() => {
    const y = new Date().getFullYear();
    if (y < 2026) return [2026];
    return Array.from({ length: y - 2026 + 1 }, (_, i) => 2026 + i);
  }, []);
  const customYears = [2026, 2027];
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
    if (exportRange === "range") {
      return entries.filter((e) => e.date >= exportRangeFrom && e.date <= exportRangeTo);
    }
    if (exportRange === "all") {
      return entries;
    }
    return entries.filter((e) => e.date.startsWith(y));
  }, [entries, exportYear, exportRange, exportMonth, exportRangeFrom, exportRangeTo]);

  const runExportExcel = () => {
    const toExport = getEntriesForExport();
    const sorted = [...toExport].sort((a, b) => a.date.localeCompare(b.date));
    const dataRows: (string | number)[][] = [];
    for (const e of sorted) {
      const kw = getKeywordsForMonth(keywords, monthExtras, toYearMonth(e.date));
      const details = entryDetails.filter((d) => d.parentId === e.id);
      if (details.length > 0) {
        for (const d of details) {
          const cat = getCategoryForEntry(d.item.trim(), kw);
          dataRows.push([e.date, d.item.trim(), CATEGORY_LABELS[cat], d.amount]);
        }
      } else {
        const cat = getCategoryForEntry(e.item, kw);
        dataRows.push([e.date, e.item, CATEGORY_LABELS[cat], e.amount]);
      }
    }
    dataRows.sort((a, b) => {
      const dateCmp = String(a[0]).localeCompare(String(b[0]));
      return dateCmp !== 0 ? dateCmp : String(a[1]).localeCompare(String(b[1]));
    });
    const rows: (string | number)[][] = [["날짜", "항목", "구분", "금액"], ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "가계부");
    const suffix =
      exportRange === "year"
        ? `${exportYear}년`
        : exportRange === "month"
          ? `${exportYear}-${String(exportMonth).padStart(2, "0")}`
          : exportRange === "range"
            ? `${exportRangeFrom}_${exportRangeTo}`
            : "전체";
    const fileName = `가계부_${suffix}.xlsx`;
    XLSX.writeFile(wb, fileName);
    setShowExportModal(false);
  };

  /** 연도별 총 지출: 21~25 고정값, 2026년~ 가계부 입력 합계 */
  const FIXED_TOTAL_EXPENSE: Record<number, number> = {
    2021: 54_188_966,
    2022: 55_234_232,
    2023: 78_522_191,
    2024: 50_312_782,
    2025: 62_880_691,
  };

  /** 연도별 총 매출 고정값 (있으면 수입 데이터 대신 사용) */
  const FIXED_TOTAL_INCOME: Record<number, number> = {
    2023: 51_182_684,
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
      const 매출 =
        FIXED_TOTAL_INCOME[yNum] ??
        incomeEntries.filter((e) => e.year === yNum).reduce((s, e) => s + e.amount, 0);
      const 지출표시값 =
        FIXED_TOTAL_EXPENSE[yNum] ??
        (yNum >= 2026
          ? entries
              .filter((e) => e.date.startsWith(String(yNum)))
              .reduce((s, e) => s + (isExcludedFromMonthTotal(e.item) ? 0 : e.amount), 0)
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
      <div className="relative pr-12 sm:pr-0">
        <SectionTitle
          title="가계부"
          subtitle="지출을 입력하고, 월별·주간으로 한눈에 보세요."
        />
        <button
          type="button"
          onClick={() => setShowFinanceSettingsMenu(true)}
          className="absolute right-0 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 sm:hidden"
          aria-label="검색·키워드 관리·내보내기"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
      {budgetLoading && (
        <p className="text-sm text-neutral-500">불러오는 중…</p>
      )}

      {/* PC만 표시. 모바일은 설정 아이콘 → 메뉴에서 검색·키워드 관리·내보내기 */}
      <div className="hidden flex-col gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
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
            내보내기
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
            검색 결과 <strong className="text-neutral-700">{searchResultRows.length}</strong>건
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
          {searchResultRows.length === 0 ? (
            <p className="mt-4 py-6 text-center text-sm text-neutral-500">
              검색어에 맞는 지출이 없어요.
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-neutral-500">연도:</span>
                <select
                  value={searchYearFilter}
                  onChange={(e) => setSearchYearFilter(e.target.value)}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-800"
                >
                  <option value="all">전체</option>
                  {[2021, 2022, 2023, 2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={String(y)}>{y}년</option>
                  ))}
                </select>
              </div>
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
                    {filteredSearchRows
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((r) => {
                        const kw = getKeywordsForMonth(keywords, monthExtras, toYearMonth(r.date));
                        const cat = getCategoryForEntry(r.item, kw);
                        return (
                          <tr key={r.rowId} className="border-t border-neutral-100">
                            <td className="px-3 py-2 text-neutral-700">{formatDateLabel(r.date)}</td>
                            <td className="px-3 py-2 text-neutral-800">{r.item}</td>
                            <td className="px-3 py-2 text-neutral-600">{CATEGORY_LABELS[cat]}</td>
                            <td className="px-3 py-2 text-right font-medium text-neutral-900">
                              {formatNum(r.amount)}원
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-right text-sm font-semibold text-neutral-800">
                검색 결과 합계: <strong>{formatNum(filteredSearchRows.reduce((s, r) => s + r.amount, 0))}</strong>원
                {searchYearFilter !== "all" && (
                  <span className="ml-1.5 font-normal text-neutral-500">({searchYearFilter}년 기준)</span>
                )}
              </p>
            </>
          )}
        </Card>
      )}

      {/* 일별 입력 */}
      <Card>
        <h2 className="text-lg font-semibold text-neutral-900">일별 지출 입력</h2>
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
              d.setDate(d.getDate() - 1);
              setSelectedDate(
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
              );
            }}
            className="flex h-[42px] items-center rounded-lg border border-neutral-200 bg-white px-3 text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
            title="이전 날"
            aria-label="이전 날"
          >
            <span className="text-lg">←</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date(selectedDate + "T12:00:00");
              d.setDate(d.getDate() + 1);
              setSelectedDate(
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
              );
            }}
            className="flex h-[42px] items-center rounded-lg border border-neutral-200 bg-white px-3 text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
            title="다음 날"
            aria-label="다음 날"
          >
            <span className="text-lg">→</span>
          </button>
          <ItemInput
            value={newItem}
            onChange={setNewItem}
            onEnterKey={() => addEntryRef.current()}
            inputRef={itemInputRef}
          />
          <div className="w-28">
            <label className="text-xs font-medium text-neutral-500">금액</label>
            <input
              ref={amountInputRef}
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
            className="inline-flex h-10 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-800 px-0 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:pointer-events-none disabled:opacity-60 md:w-auto md:min-w-[4.5rem] md:px-4"
          >
            {isAdding ? (
              <>
                <span className="md:hidden">…</span>
                <span className="hidden md:inline">저장 중…</span>
              </>
            ) : (
              <>
                <span className="md:hidden">+</span>
                <span className="hidden md:inline">추가</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setCardSectionOpen((o) => !o)}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border-2 border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-500 hover:bg-neutral-50 md:px-4"
          >
            <span className="md:hidden">카드</span><span className="hidden md:inline">카드지출</span> {cardSectionOpen ? "▲" : "▼"}
          </button>
        </form>

        {/* 카드지출 — 버튼으로만 펼침/접기 */}
        {cardSectionOpen && (
          <div ref={cardSectionRef} className="mt-4 border-t border-neutral-200 pt-4">
            <div className="mt-4 max-w-lg">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-[4]">
                  <label className="block text-xs font-medium text-neutral-500">항목명</label>
                  <input
                    type="text"
                    value={cardSectionItem}
                    onChange={(e) => setCardSectionItem(e.target.value)}
                    placeholder="예: 카드출금"
                    className="mt-1 block w-full min-w-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                  />
                </div>
                <div className="min-w-0 flex-[6]">
                  <label className="block text-xs font-medium text-neutral-500">카드 총합 (원)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cardSectionTotal}
                    onChange={(e) => setCardSectionTotal(e.target.value.replace(/[^0-9,]/g, ""))}
                    placeholder="0"
                    className="mt-1 block w-full min-w-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                  />
                </div>
                <button
                  type="button"
                  onClick={addCardSectionDetailRow}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
                  title="세부 추가"
                >
                  +<span className="hidden sm:inline"> 세부 추가</span>
                </button>
                <button
                  type="button"
                  onClick={applyCardSection}
                  disabled={cardSectionApplying}
                  className="rounded-xl bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:pointer-events-none disabled:opacity-60"
                >
                  {cardSectionApplying ? "반영 중…" : "반영"}
                </button>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-medium text-neutral-500">세부 내역 (항목 · 금액)</label>
                <ul className="mt-2 space-y-1.5">
                  {cardSectionDetails.map((row, idx) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2"
                    >
                      <input
                        ref={idx === cardSectionDetails.length - 1 ? lastDetailItemRef : undefined}
                        type="text"
                        value={row.item}
                        onChange={(e) =>
                          setCardSectionDetails((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, item: e.target.value } : r))
                          )
                        }
placeholder="항목"
                      className="min-w-0 flex-[6] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                    />
                    <input
                      type="number"
                      min={0}
                      value={row.amount || ""}
                      onChange={(e) =>
                        setCardSectionDetails((prev) =>
                          prev.map((r) =>
                            r.id === row.id ? { ...r, amount: Number(e.target.value) || 0 } : r
                          )
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCardSectionDetailRow();
                        }
                      }}
                      placeholder="금액"
                      className="min-w-0 flex-[4] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                    />
                      <button
                        type="button"
                        onClick={() =>
                          setCardSectionDetails((prev) => prev.filter((r) => r.id !== row.id))
                        }
                        className="flex h-[38px] items-center justify-center rounded-lg px-2 text-neutral-400 transition hover:bg-neutral-200 hover:text-red-600"
                        aria-label="행 삭제"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card>
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
                const isListEditing = listEditId === e.id;
                return (
                  <li
                    key={e.id}
                    onDoubleClick={() => {
                      if (listEditId != null) return;
                      setListEditId(e.id);
                      setListEditItem(e.item);
                      setListEditAmount(String(e.amount));
                    }}
                    className={`flex flex-wrap items-center justify-between gap-y-1 rounded-lg border border-neutral-200 px-4 py-2 text-sm ${isListEditing ? "bg-white" : "bg-neutral-50"}`}
                  >
                    <div className="flex w-full items-center justify-between">
                    {isListEditing ? (
                      <>
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={listEditItem}
                            onChange={(ev) => setListEditItem(ev.target.value)}
                            className="min-w-[120px] flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-neutral-900"
                            placeholder="항목"
                            onClick={(ev) => ev.stopPropagation()}
                          />
                          <input
                            type="number"
                            min={1}
                            value={listEditAmount}
                            onChange={(ev) => setListEditAmount(ev.target.value)}
                            className="w-24 rounded-lg border border-neutral-200 px-2 py-1.5 text-neutral-900"
                            placeholder="금액"
                            onClick={(ev) => ev.stopPropagation()}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              const amount = Number(String(listEditAmount).replace(/,/g, ""));
                              if (listEditItem.trim() && Number.isFinite(amount) && amount > 0) {
                                updateEntry(e.id, listEditItem.trim(), amount);
                                setListEditId(null);
                              }
                            }}
                            className="rounded-lg bg-neutral-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-700"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setListEditId(null);
                            }}
                            className="rounded-lg px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              removeEntry(e.id);
                              setListEditId(null);
                            }}
                            className="text-neutral-400 hover:text-red-600"
                            aria-label="삭제"
                          >
                            ×
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="font-medium text-neutral-800">{e.item}</span>
                          <span className="ml-2 text-xs text-neutral-500">{CATEGORY_LABELS[cat]}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900">
                            {formatNum(e.amount)}원
                          </span>
                          {entryDetails.some((d) => d.parentId === e.id) && (
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                openCardExpenseModal(e);
                              }}
                              className="rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700 hover:bg-neutral-300"
                            >
                              수정
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              removeEntry(e.id);
                            }}
                            className="text-neutral-400 hover:text-red-600"
                            aria-label="삭제"
                          >
                            ×
                          </button>
                        </div>
                      </>
                    )}
                    </div>
                    {!isListEditing && entryDetails.some((d) => d.parentId === e.id) && (() => {
                      const details = entryDetails.filter((d) => d.parentId === e.id);
                      const isExpanded = expandedDailyDetailIds.has(e.id);
                      return (
                        <div className="w-full border-t border-neutral-200 mt-1.5 pt-1.5">
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setExpandedDailyDetailIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(e.id)) next.delete(e.id);
                                else next.add(e.id);
                                return next;
                              });
                            }}
                            className="flex w-full items-center justify-between rounded-md py-1 px-2 text-left text-sm font-medium text-neutral-600 hover:bg-neutral-100"
                            aria-expanded={isExpanded}
                          >
                            <span>세부 내역 ({details.length}건)</span>
                            <span className="text-neutral-400" aria-hidden>{isExpanded ? "▲" : "▼"}</span>
                          </button>
                          {isExpanded && (
                            <ul className="mt-1.5 rounded-lg bg-neutral-100/80 px-3 py-2">
                              {details.map((d, idx) => (
                                <li
                                  key={d.id}
                                  className={`flex items-center justify-between gap-3 py-1.5 text-sm text-neutral-800 ${idx > 0 ? "border-t border-neutral-200/70" : ""}`}
                                >
                                  <span className="min-w-0 truncate font-medium">{d.item}</span>
                                  <span className="shrink-0 tabular-nums font-semibold">
                                    {formatNum(d.amount)}원
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })()}
                  </li>
                );
              })}
            </ul>
          )}
      </Card>

      {/* 보기: 이번달(1~12월 드롭다운, 기본 현재월) / 특정(2026·2027) / 한눈에 */}
      <Card>
        <h2 className="text-lg font-semibold text-neutral-900">기간별 보기</h2>
        <div ref={periodDropdownRef} className="mt-3 mb-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setViewMode("yearMonth");
                setYearMonthSelect(new Date().getMonth() + 1);
                setPeriodDropdown((d) => (d === "yearMonth" ? null : "yearMonth"));
              }}
              className={`flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
                viewMode === "yearMonth"
                  ? "bg-neutral-800 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              이번달
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
              특정
              <span className="text-[10px] opacity-80">▼</span>
            </button>
            {periodDropdown === "custom" && (
              <div className="absolute left-0 top-full z-10 mt-1 flex gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg">
                <select
                  value={customYears.includes(customYear) ? customYear : 2026}
                  onChange={(e) => setCustomYear(Number(e.target.value))}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
                >
                  {customYears.map((y) => (
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
          <button
            type="button"
            onClick={() => setViewMode("yearAtGlance")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              viewMode === "yearAtGlance"
                ? "bg-neutral-800 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            한눈에
          </button>
        </div>

        {viewMode === "yearAtGlance" && (
          <div className="mt-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-medium text-neutral-600">연도</span>
              <select
                value={glanceYear}
                onChange={(e) => setGlanceYear(Number(e.target.value))}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value={2021}>2021년</option>
                <option value={2022}>2022년</option>
                <option value={2023}>2023년</option>
                <option value={2024}>2024년</option>
                <option value={2025}>2025년</option>
                <option value={2026}>2026년</option>
                <option value={2027}>2027년</option>
              </select>
            </div>
            <div className="text-base font-semibold text-neutral-800">{viewYearByMonthGlance.year}년 1~12월 지출</div>
            <div className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                const total = viewYearByMonthGlance.byMonth[m] ?? 0;
                return (
                  <div key={m} className="rounded-lg border border-neutral-200 bg-white px-2 py-2.5 text-center md:px-3 md:py-3">
                    <div className="text-xs text-neutral-500 md:text-sm">{m}월</div>
                    <div className="mt-0.5 text-sm font-semibold text-neutral-800 md:text-lg">{formatAmountShort(total)}</div>
                  </div>
                );
              })}
            </div>
            {(() => {
              const yearTotal = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].reduce(
                (s, m) => s + (viewYearByMonthGlance.byMonth[m] ?? 0),
                0
              );
              return (
                <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-neutral-200 pt-4 text-sm">
                  <span className="text-neutral-600">
                    한해 총 지출: <AmountToggle amount={yearTotal} className="font-semibold" />
                  </span>
                  <span className="text-neutral-600">
                    월 평균 지출: <AmountToggle amount={Math.round(yearTotal / 12)} className="font-semibold" />
                  </span>
                </div>
              );
            })()}
          </div>
        )}

        {(viewMode === "yearMonth" || viewMode === "custom") && (
          <div className="mt-4 space-y-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-2xl font-semibold text-neutral-900">
                <span>
                  {parseInt(yearMonthForView.split("-")[1], 10)}월 지출:{" "}
                  <AmountToggle amount={viewMonthTotalDisplay} />
                </span>
                <div
                  className="relative"
                  onMouseEnter={() => {
                    monthExpenseTooltipHoverRef.current = window.setTimeout(() => setShowMonthExpenseTooltip(true), 150);
                  }}
                  onMouseLeave={() => {
                    if (monthExpenseTooltipHoverRef.current) {
                      clearTimeout(monthExpenseTooltipHoverRef.current);
                      monthExpenseTooltipHoverRef.current = null;
                    }
                    setShowMonthExpenseTooltip(false);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowMonthExpenseTooltip((v) => !v)}
                    className="flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-xs font-medium text-neutral-500 transition hover:border-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
                    aria-label="지출 금액 설명"
                  >
                    ?
                  </button>
                  {showMonthExpenseTooltip && (
                    <div
                      className="absolute left-0 top-full z-10 mt-2 w-72 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm leading-relaxed text-neutral-700 shadow-lg"
                      role="tooltip"
                    >
                      {viewMonthExcluded > 0 ? (
                        <>적금·IRP·ISA·주택청약은 제외한 금액이에요. (제외: {formatNum(viewMonthExcluded)}원)</>
                      ) : (
                        <>적금·IRP·ISA·주택청약은 제외한 금액이에요.</>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-[13.5px] md:text-sm">
              {(
                ["고정비", "생활비", "기타", "세금", "사업경비"] as const
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryDetailModal(cat)}
                  className="inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-neutral-800 transition hover:border-slate-400 hover:bg-slate-200 hover:shadow-sm md:gap-3 md:px-4"
                >
                  <span className="font-semibold">{CATEGORY_LABELS[cat]}</span>
                  <span className="font-medium">
                    {formatAmountShort(viewMonthByCategory[cat])}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowCardExpenseDetailModal(true)}
                className="inline-flex items-center gap-2.5 rounded-full border border-violet-200 bg-violet-50/90 px-3.5 py-2 text-violet-900 transition hover:border-violet-300 hover:bg-violet-100 hover:shadow-sm md:gap-3 md:px-4"
              >
                <span className="font-semibold">카드출금</span>
                <span className="font-medium">
                  {formatAmountShort(viewMonthCardExpenseSummary.total)}
                </span>
              </button>
            </div>
            <div className="mt-5 pt-3">
              <div className="text-base font-semibold text-neutral-800">[ 해당 월 일별 내역 ]</div>
              {Object.keys(viewMonthByDay).length === 0 ? (
                <p className="mt-3 text-sm text-neutral-400">해당 월에 입력된 내역이 없어요.</p>
              ) : (
                <div className="mt-3">
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-neutral-400 sm:gap-1.5 sm:text-[11px] md:text-[15px]">
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
                      const amountBg =
                        total >= 1_000_000
                          ? "bg-red-500 hover:bg-red-600 text-white"
                          : total >= 500_000
                            ? "bg-red-400 hover:bg-red-500 text-white"
                            : total >= 300_000
                              ? "bg-red-300 hover:bg-red-400 text-red-900"
                              : total >= 100_000
                                ? "bg-red-200 hover:bg-red-300 text-red-900"
                                : total > 10_000
                                  ? "bg-red-100 hover:bg-red-200 text-red-900"
                                  : total > 0
                                    ? "bg-red-50 hover:bg-red-100 text-red-800"
                                    : "";
                      const isToday = dateStr === todayDateStr;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => hasData && setDayDetailDate(dateStr)}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setCalendarDayTooltip({
                              dateStr,
                              left: rect.right - 25,
                              top: rect.top + 40,
                            });
                          }}
                          onMouseLeave={() => setCalendarDayTooltip(null)}
                          className={`aspect-square rounded-lg px-1.5 text-center transition ${
                            isToday ? "ring-2 ring-neutral-900 ring-offset-1 ring-offset-white" : ""
                          } ${
                            hasData
                              ? `${amountBg} font-medium ${isToday ? "" : "ring-2 ring-transparent hover:ring-neutral-300"}`
                              : "text-neutral-400"
                          }`}
                        >
                          <div className="text-[15px]">{day}</div>
                          {hasData && (
                            <div className="mt-1 truncate text-[13px] font-semibold hidden md:block md:text-[15px]">
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

      {/* PC: 달력 날짜 호버 툴팁 (body 포탈로 뷰포트 기준 위치) */}
      {calendarDayTooltip &&
        typeof document !== "undefined" &&
        createPortal(
          (() => {
            const entries = viewMonthByDay[calendarDayTooltip.dateStr];
            const list = entries ?? [];
            return (
              <div
                className="pointer-events-none fixed z-[110] hidden min-w-[160px] max-w-[260px] rounded-xl border border-neutral-200 bg-white py-2 shadow-lg md:block"
                style={{
                  left: `${calendarDayTooltip.left}px`,
                  top: `${calendarDayTooltip.top}px`,
                }}
              >
                <div className="px-3 py-1 text-xs font-semibold text-neutral-500 border-b border-neutral-100">
                  {formatDateLabel(calendarDayTooltip.dateStr)}
                </div>
                <div className="px-3 py-2">
                  {list.length === 0 ? (
                    <p className="text-sm text-neutral-400">지출 없음</p>
                  ) : (
                    <ul className="space-y-1.5 text-sm">
                      {list.map((e) => (
                        <li key={e.id} className="flex justify-between gap-2 text-neutral-800">
                          <span className="min-w-0 truncate" title={e.item}>
                            {e.item}
                          </span>
                          <span className="shrink-0 font-medium text-neutral-900">
                            {formatNum(e.amount)}원
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {list.length > 0 && (
                  <div className="border-t border-neutral-100 px-3 py-1.5 text-right text-xs font-semibold text-neutral-600">
                    합계 {formatNum(list.reduce((s, e) => s + e.amount, 0))}원
                  </div>
                )}
              </div>
            );
          })(),
          document.body
        )}

      {/* 모바일: 검색·키워드 관리·내보내기 메뉴 */}
      {showFinanceSettingsMenu &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center overflow-y-auto bg-black/65 p-4 sm:hidden"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={() => setShowFinanceSettingsMenu(false)}
          >
            <div
              className="my-auto w-full max-w-md shrink-0 rounded-2xl bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-neutral-900">검색·설정</h3>
              <div className="mt-4 space-y-4">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    placeholder="항목으로 검색"
                    className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-10 text-sm text-neutral-800 placeholder:text-neutral-400"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                      aria-label="검색 지우기"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {searchQuery.trim() && (
                  <p className="text-sm text-neutral-500">
                    검색 결과 <strong className="text-neutral-700">{searchResultRows.length}</strong>건
                  </p>
                )}
                <div className="flex flex-col gap-2 border-t border-neutral-100 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFinanceSettingsMenu(false);
                      setShowKeywordModal(true);
                    }}
                    className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                  >
                    키워드 관리
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFinanceSettingsMenu(false);
                      setShowExportModal(true);
                    }}
                    className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                  >
                    내보내기
                  </button>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowFinanceSettingsMenu(false)}
                  className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-300"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 내보내기 모달 (body에 포탈 → 화면 전체 어둡게) */}
      {showExportModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center overflow-y-auto bg-black/65 p-4"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={() => setShowExportModal(false)}
          >
            <div
              className="my-auto w-full max-w-md shrink-0 rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-neutral-900">가계부 내보내기</h3>
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
                      checked={exportRange === "year"}
                      onChange={() => setExportRange("year")}
                      className="text-neutral-700"
                    />
                    <span className="text-sm">특정 연도</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="exportRange"
                      checked={exportRange === "range"}
                      onChange={() => setExportRange("range")}
                      className="text-neutral-700"
                    />
                    <span className="text-sm">특정 기간</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="exportRange"
                      checked={exportRange === "all"}
                      onChange={() => setExportRange("all")}
                      className="text-neutral-700"
                    />
                    <span className="text-sm">전부</span>
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
              {exportRange === "range" && (
                <div>
                  <label className="block text-xs font-medium text-neutral-500">시작일 ~ 종료일</label>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={exportRangeFrom}
                      onChange={(e) => setExportRangeFrom(e.target.value)}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                    />
                    <span className="text-neutral-400">~</span>
                    <input
                      type="date"
                      value={exportRangeTo}
                      onChange={(e) => setExportRangeTo(e.target.value)}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                    />
                  </div>
                </div>
              )}
              {exportRange === "all" && (
                <p className="text-sm text-neutral-600">저장된 전체 데이터를 내보냅니다.</p>
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
                내보내기
              </button>
            </div>
          </div>
        </div>,
          document.body
        )}

      {/* 날짜별 상세 모달 (달력 셀 클릭) */}
      {dayDetailDate &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-screen min-w-full items-center justify-center overflow-y-auto bg-black/65 p-4"
            onClick={() => {
              setDayDetailDate(null);
              setDayDetailEditingId(null);
            }}
          >
            <div
              className="my-auto w-full max-w-md shrink-0 rounded-2xl bg-white p-6 shadow-xl"
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
        </div>,
        document.body
      )}

      {/* 카드지출 입력 모달 - body에 포탈, 화면 중앙·배경 전체 어둡게 */}
      {showCardExpenseModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-black/65 p-4"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowCardExpenseModal(false);
                setCardModalEditEntry(null);
              }
            }}
          >
          <div
            ref={cardModalContentRef}
            className="my-8 max-h-[85vh] w-full max-w-lg shrink-0 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <form ref={cardModalFormRef} onSubmit={(e) => e.preventDefault()}>
              <h3 className="text-lg font-semibold text-neutral-900">
                {cardModalEditEntry ? "카드지출 수정" : "카드지출 입력"}
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                항목명은 아무 이름이나 적어도 됩니다 (비우면 &quot;카드출금&quot;). 카드 총합을 먼저 적고, 세부내역을 추가한 뒤 반영하세요.
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                저장 위치: {supabase ? "Supabase 서버" : "이 기기만 (로컬) — 지금 로컬에서 테스트 중이에요."}
              </p>
              {cardExpenseMessage && (
                <div
                  className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                    cardExpenseMessage.type === "error" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {cardExpenseMessage.text}
                </div>
              )}
              <div className="mt-4 space-y-3">
                {cardModalEditEntry && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-500">날짜 (잘못 입력했을 때 여기서 수정)</label>
                    <input
                      type="date"
                      value={cardModalDate}
                      onChange={(e) => setCardModalDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-neutral-500">항목명 (예: KB카드출금)</label>
                  <input
                    name="card-modal-item"
                    type="text"
                    value={cardModalItem}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCardModalItem(v);
                      cardModalItemRef.current = v;
                    }}
                    placeholder="카드출금"
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500">카드 총합 (원)</label>
                  <input
                    name="card-modal-total"
                    type="number"
                    min={1}
                    value={cardModalTotal}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCardModalTotal(v);
                      cardModalTotalRef.current = v;
                    }}
                    placeholder="0"
                    className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="border-t border-neutral-200 pt-3">
                  <div className="text-xs font-medium text-neutral-500">세부내역 (항목명에 키워드가 있으면 카테고리 자동 분류)</div>
                  <div className="mt-2 space-y-2">
                    {cardModalDetails.map((row, idx) => (
                      <div
                        key={row.id}
                        data-card-detail-row
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50/50 p-2"
                      >
                        <input
                          data-card-detail-item
                          ref={idx === cardModalDetails.length - 1 ? lastDetailItemInputRef : undefined}
                          type="text"
                          value={row.item}
                          onChange={(e) => updateCardModalDetailRow(row.id, "item", e.target.value)}
                          placeholder="항목"
                          className="min-w-[100px] flex-1 rounded border border-neutral-200 px-2 py-1.5 text-sm"
                        />
                        <input
                          data-card-detail-amount
                          type="number"
                          min={0}
                          value={row.amount || ""}
                          onChange={(e) => updateCardModalDetailRow(row.id, "amount", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCardModalDetailRow(true);
                            }
                          }}
                          placeholder="금액"
                          className="w-24 rounded border border-neutral-200 px-2 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeCardModalDetailRow(row.id)}
                          className="text-neutral-400 hover:text-red-600"
                          aria-label="삭제"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addCardModalDetailRow(false)}
                      className="w-full rounded-lg border border-dashed border-neutral-300 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
                    >
                      + 세부 추가
                    </button>
                  </div>
                </div>
              </div>
              {(() => {
                const total = Number(String(cardModalTotal).replace(/,/g, "")) || 0;
                const valid = cardModalDetails.filter(
                  (r) => r.item.trim() && Number.isFinite(r.amount) && r.amount > 0
                );
                const detailSum = valid.reduce((s, r) => s + r.amount, 0);
                const unclassified = total - detailSum;
                return (
                  <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">세부 합계</span>
                      <span className="font-medium">{formatNum(detailSum)}원</span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-neutral-600">미분류 (총합 − 세부)</span>
                      <span className="font-medium">{formatNum(unclassified >= 0 ? unclassified : 0)}원</span>
                    </div>
                  </div>
                );
              })()}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCardExpenseModal(false);
                    setCardModalEditEntry(null);
                  }}
                  className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-300"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={cardModalEditEntry ? cardExpenseApplying : false}
                  className="rounded-xl bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 disabled:pointer-events-none"
                  onClick={() => {
                    if (cardModalEditEntry) {
                      applyCardExpense();
                      return;
                    }
                    const form = cardModalFormRef.current;
                    const totalEl = form?.querySelector<HTMLInputElement>('[name="card-modal-total"]');
                    const itemEl = form?.querySelector<HTMLInputElement>('[name="card-modal-item"]');
                    const amount = Number((totalEl?.value ?? "").replace(/,/g, "")) || 0;
                    const item = (itemEl?.value ?? "").toString().trim() || "카드출금";
                    if (amount <= 0) {
                      setCardExpenseMessage({ type: "error", text: "카드 총합(원)에 숫자를 입력해 주세요." });
                      return;
                    }
                    const id = `e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                    const newEntry: BudgetEntry = { id, date: selectedDate, item, amount };
                    setEntries((prev) => [...prev, newEntry]);
                    setShowCardExpenseModal(false);
                    setCardModalTotal("");
                    setCardModalDetails([]);
                    insertEntry(newEntry)
                      .then((saved) => {
                        if (saved.id !== newEntry.id) {
                          setEntries((prev) => prev.map((e) => (e.id === newEntry.id ? saved : e)));
                        }
                      })
                      .catch((err) => {
                        console.error("가계부 저장 실패", err);
                        setEntries((prev) => prev.filter((e) => e.id !== newEntry.id));
                        alert("저장 실패. F12 콘솔 확인.");
                      });
                  }}
                >
                  {cardModalEditEntry && cardExpenseApplying ? "반영 중…" : "반영"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 카테고리별 상세 항목 모달 */}
      {categoryDetailModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-screen min-w-full items-center justify-center overflow-y-auto bg-black/65 p-4"
            onClick={() => {
              setCategoryDetailModal(null);
              setExpandedDetailItems(new Set());
            }}
          >
            <div
              className="my-auto max-h-[85vh] w-full max-w-2xl shrink-0 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
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
                          className="flex w-full items-center justify-between p-4 text-left hover:bg-neutral-100/80 transition-colors text-[13px] md:text-base"
                        >
                          <span className="font-semibold text-neutral-900">{itemName} ({entries.length})</span>
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-neutral-900 md:text-lg">
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
                          <ul className="border-t border-neutral-200 space-y-1.5 px-4 pb-4 pt-2 pl-0 text-[13px] text-neutral-600 md:text-sm">
                            {entries.map(({ date, amount, item }, i) => (
                              <li
                                key={`${date}-${item}-${i}`}
                                className="flex justify-between gap-2 rounded-lg bg-white px-3 py-1.5"
                              >
                                <span className="min-w-0">
                                  <span className="mr-3 text-neutral-500">{formatDateLabelShort(date)}</span>
                                  <span>{item}</span>
                                </span>
                                <span className="shrink-0 font-medium">{formatNum(amount)}원</span>
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
        </div>,
        document.body
      )}

      {/* 카드출금 상세 모달: 총합·세부·미분류 한눈에 */}
      {showCardExpenseDetailModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-screen min-w-full items-center justify-center overflow-y-auto bg-black/65 p-4"
            onClick={() => setShowCardExpenseDetailModal(false)}
          >
            <div
              className="my-auto max-h-[85vh] w-full max-w-2xl shrink-0 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-neutral-900">
                카드출금 · {yearMonthForView} 상세
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                해당 월 카드출금 총합, 세부 내역, 미분류를 한눈에 볼 수 있어요.
              </p>
              {viewMonthCardExpenseSummary.total <= 0 ? (
                <p className="mt-4 text-sm text-neutral-400">해당 월 카드출금 내역이 없어요.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl bg-slate-100 px-4 py-3">
                    <span className="text-sm font-medium text-neutral-600">총합</span>
                    <span className="ml-2 text-xl font-semibold text-neutral-900">
                      {formatNum(viewMonthCardExpenseSummary.total)}원
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-neutral-600">세부 내역</div>
                    <div className="mt-2 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50/50 p-3">
                      {(() => {
                        const byDate = new Map<string, { entry: BudgetEntry; details: BudgetEntryDetail[] }[]>();
                        viewMonthCardExpenseSummary.rows.forEach((r) => {
                          if (!byDate.has(r.entry.date)) byDate.set(r.entry.date, []);
                          byDate.get(r.entry.date)!.push(r);
                        });
                        const sortedDates = Array.from(byDate.keys()).sort();
                        return sortedDates.map((date) => {
                          const flatDetails = byDate.get(date)!.flatMap(({ details }) => details);
                          return (
                            <div key={date}>
                              <div className="text-xs font-medium text-neutral-500">
                                {formatDateLabelShort(date)}
                              </div>
                              <ul className="mt-1">
                                {flatDetails.map((d, idx) => (
                                  <li
                                    key={d.id}
                                    className={`flex justify-between gap-2 py-1.5 text-[11px] text-neutral-800 md:text-sm ${idx > 0 ? "border-t border-neutral-200/70" : ""}`}
                                  >
                                    <span className="min-w-0 truncate">{d.item}</span>
                                    <span className="shrink-0 tabular-nums font-medium">
                                      {formatNum(d.amount)}원
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                  {viewMonthCardExpenseSummary.unclassifiedTotal > 0 && (
                    <div className="flex items-baseline justify-between rounded-xl bg-slate-100 px-4 py-3">
                      <span className="text-sm font-medium text-neutral-600">미분류 (총합 − 세부)</span>
                      <span className="text-sm font-medium text-neutral-900">
                        {formatNum(viewMonthCardExpenseSummary.unclassifiedTotal)}원
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowCardExpenseDetailModal(false)}
                  className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-300"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 키워드 관리 모달 */}
      {showKeywordModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center overflow-y-auto bg-black/65 p-4"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={() => {
              setShowKeywordModal(false);
              setAddKeywordCategory(null);
              setAddKeywordValue("");
              setPendingKeyword(null);
            }}
          >
            <div className="flex min-h-full items-center justify-center py-8">
              <div
                className="my-auto max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
            <h3 className="text-lg font-semibold text-neutral-900">카테고리 키워드 관리</h3>
            <p className="mt-1 text-sm text-neutral-500">
              항목명에 포함된 키워드로 자동 분류돼요. 키워드는 추가·삭제할 수 있어요.
            </p>
            <div className="mt-4 space-y-4">
              {((Object.keys(CATEGORY_LABELS) as DisplayCategoryId[]).filter((c): c is CategoryId => c !== "미분류")).map((cat) => {
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
        </div>,
        document.body
      )}

      {/* 연도별 통계 */}
      <Card className="overflow-hidden">
        <h2 className="text-lg font-semibold text-neutral-900">연도별 통계</h2>
        <p className="mt-1 text-sm text-neutral-500">
          수입 데이터와 연도별 총 지출을 반영해요.
        </p>
        <div className="mt-4 overflow-auto rounded-xl">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80">
                <th className="sticky left-0 z-10 min-w-[4.5rem] bg-neutral-50 px-4 py-3 font-semibold text-neutral-700 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  연도
                </th>
                <th className="px-4 py-3 font-semibold text-neutral-700 text-right">총 매출</th>
                <th className="px-4 py-3 font-semibold text-neutral-700 text-right">순수익</th>
                <th className="px-4 py-3 font-semibold text-neutral-700 text-right">총 지출</th>
                <th className="px-4 py-3 font-semibold text-neutral-700 text-right">저축</th>
                <th className="px-4 py-3 font-semibold text-neutral-700 text-right">월평균수익</th>
              </tr>
            </thead>
            <tbody>
              {[...yearlySummary].reverse().map((row) => {
                const 순수익있음 = row.순수익 != null;
                const 저축값 = row.지출데이터있음 ? row.매출 - row.지출 : null;
                return (
                  <tr
                    key={row.year}
                    className="group border-b border-neutral-100 bg-white transition hover:bg-neutral-50 hover:shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)]"
                  >
                    <td className="sticky left-0 z-10 min-w-[4.5rem] bg-white px-4 py-3 font-medium text-neutral-800 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] group-hover:bg-neutral-50">
                      {row.year}년
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-700">
                      <AmountToggle amount={row.매출} />
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${!순수익있음 ? "text-neutral-500" : ""}`}
                    >
                      {!순수익있음 ? "데이터 없음" : (
                        <AmountToggle
                          amount={row.순수익!}
                          variant={row.순수익! >= 0 ? "profit" : "loss"}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">
                      {row.지출데이터있음 ? (
                        <AmountToggle amount={row.지출} variant="loss" />
                      ) : (
                        "데이터 없음"
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${저축값 !== null ? "" : "text-neutral-500"}`}
                    >
                      {저축값 !== null ? (
                        <AmountToggle
                          amount={저축값}
                          variant={저축값 >= 0 ? "profit" : "loss"}
                        />
                      ) : (
                        "데이터 없음"
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right ${!순수익있음 ? "text-neutral-500" : ""}`}>
                      {!순수익있음 ? "데이터 없음" : (
                        <AmountToggle
                          amount={Math.round(row.월평균수익)}
                          variant={row.월평균수익 >= 0 ? "profit" : "loss"}
                        />
                      )}
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
