"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Card } from "@/components/ui/Card";
import { AmountToggle } from "@/components/ui/AmountToggle";
import {
  type BudgetEntry,
  DEFAULT_KEYWORDS,
  getCategoryForEntry,
  getKeywordsForMonth,
  loadEntries,
  loadKeywords,
  loadMonthExtras,
  type MonthExtraKeywords,
  saveEntries as saveBudgetEntries,
  SEED_BUDGET_2021_TAX,
  SEED_BUDGET_2022_TAX,
  SEED_BUDGET_2023_TAX,
  SEED_BUDGET_2024_TAX,
  SEED_BUDGET_2025_TAX,
} from "@/lib/budget";
import {
  type IncomeEntry,
  DEFAULT_INCOME_CATEGORIES,
  loadIncomeEntries,
  loadIncomeCategories,
  saveIncomeEntries,
  saveIncomeCategories,
  SEED_INCOME_2021,
  SEED_INCOME_2022,
  SEED_INCOME_2023,
  SEED_INCOME_2024,
  SEED_INCOME_2025,
  TAX_EXPENSE_CATEGORIES,
} from "@/lib/income";
import * as XLSX from "xlsx";

function formatNum(n: number): string {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function yearLabel(y: number, current: number): string {
  return y === current ? "올해" : `${y}년`;
}

export default function IncomePage() {
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [budgetEntries, setBudgetEntries] = useState<BudgetEntry[]>([]);
  const [budgetKeywords, setBudgetKeywords] = useState(DEFAULT_KEYWORDS);
  const [budgetMonthExtras, setBudgetMonthExtras] = useState<MonthExtraKeywords>({});
  const [incomeYear, setIncomeYear] = useState(new Date().getFullYear());
  const [incomeMonth, setIncomeMonth] = useState(new Date().getMonth() + 1);
  const [categories, setCategories] = useState<string[]>(DEFAULT_INCOME_CATEGORIES);
  const [newIncomeCategory, setNewIncomeCategory] = useState(
    DEFAULT_INCOME_CATEGORIES[0] ?? "홈페이지"
  );
  const [newIncomeItem, setNewIncomeItem] = useState("");
  const [newIncomeAmount, setNewIncomeAmount] = useState("");
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  /** 구분 클릭 시 상세 모달: 해당 월·구분 내역 */
  const [detailModal, setDetailModal] = useState<{ month: number; category: string } | null>(null);
  /** 수정 중인 항목 */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const now = new Date();
  const [showExportModal, setShowExportModal] = useState(false);
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
  const [editItem, setEditItem] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editMonth, setEditMonth] = useState(1);
  /** 모바일: 이전 연도(25~21) 펼침 여부 */
  const [showPastYearsMobile, setShowPastYearsMobile] = useState(false);

  const load = useCallback(async () => {
    let entries = await loadIncomeEntries();
    const yearsPresent = new Set(entries.map((e) => e.year));
    const seedByYear: [number, IncomeEntry[]][] = [
      [2021, SEED_INCOME_2021],
      [2022, SEED_INCOME_2022],
      [2023, SEED_INCOME_2023],
      [2024, SEED_INCOME_2024],
      [2025, SEED_INCOME_2025],
    ];
    let changed = false;
    for (const [year, seed] of seedByYear) {
      if (!yearsPresent.has(year) && seed.length > 0) {
        entries = [...entries, ...seed];
        yearsPresent.add(year);
        changed = true;
      }
    }
    if (changed) await saveIncomeEntries(entries);
    setIncomeEntries(entries);

    let cats = loadIncomeCategories();
    const toAdd = ["쇼핑몰", "로고", "일러스트", "기타"].filter((c) => !cats.includes(c));
    if (toAdd.length > 0) {
      cats = [...cats, ...toAdd];
      saveIncomeCategories(cats);
    }
    setCategories(cats);
    const [budgetEntriesList, kw, extras] = await Promise.all([
      loadEntries(),
      loadKeywords(),
      loadMonthExtras(),
    ]);
    // 2025 세금·경비 시드는 가계부에 저장하지 않음. 수입 페이지 '세금 및 경비' 카드에서만 집계에 사용
    setBudgetEntries(budgetEntriesList);
    setBudgetKeywords(kw);
    setBudgetMonthExtras(extras);
  }, []);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(newIncomeCategory)) {
      setNewIncomeCategory(categories[0]);
    }
  }, [categories]);

  useEffect(() => {
    load();
  }, [load]);

  const incomeEntriesForYear = useMemo(
    () => incomeEntries.filter((e) => e.year === incomeYear),
    [incomeEntries, incomeYear]
  );

  /** 검색어가 있으면 구분·항목 기준으로 필터 (해당 연도만) */
  const filteredEntriesForYear = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return incomeEntriesForYear;
    return incomeEntriesForYear.filter(
      (e) =>
        e.category.toLowerCase().includes(q) ||
        e.item.toLowerCase().includes(q)
    );
  }, [incomeEntriesForYear, searchQuery]);

  const incomeEntriesForMonth = useMemo(
    () => filteredEntriesForYear.filter((e) => e.month === incomeMonth),
    [filteredEntriesForYear, incomeMonth]
  );
  const yearIncomeTotal = useMemo(
    () => filteredEntriesForYear.reduce((s, e) => s + e.amount, 0),
    [filteredEntriesForYear]
  );
  const monthIncomeTotal = useMemo(
    () => incomeEntriesForMonth.reduce((s, e) => s + e.amount, 0),
    [incomeEntriesForMonth]
  );
  const yearExpenseTotal = useMemo(
    () =>
      budgetEntries
        .filter((e) => e.date.startsWith(String(incomeYear)))
        .reduce((s, e) => s + e.amount, 0),
    [budgetEntries, incomeYear]
  );
  const monthExpenseTotal = useMemo(
    () =>
      budgetEntries
        .filter((e) =>
          e.date.startsWith(
            `${incomeYear}-${String(incomeMonth).padStart(2, "0")}`
          )
        )
        .reduce((s, e) => s + e.amount, 0),
    [budgetEntries, incomeYear, incomeMonth]
  );

  /** 해당 연도 세금·경비 항목별 합계. 21~25년은 시드만 사용(가계부 데이터 제외), 2026~ 가계부 연동 */
  const budgetAmountByTaxCategory = useMemo(() => {
    const yearPrefix = String(incomeYear);
    let entriesInYear: typeof budgetEntries;
    if (incomeYear === 2021) {
      entriesInYear = SEED_BUDGET_2021_TAX;
    } else if (incomeYear === 2022) {
      entriesInYear = SEED_BUDGET_2022_TAX;
    } else if (incomeYear === 2023) {
      entriesInYear = SEED_BUDGET_2023_TAX;
    } else if (incomeYear === 2024) {
      entriesInYear = SEED_BUDGET_2024_TAX;
    } else if (incomeYear === 2025) {
      entriesInYear = SEED_BUDGET_2025_TAX;
    } else {
      entriesInYear = budgetEntries.filter((e) => e.date.startsWith(yearPrefix));
    }
    const result: Record<string, number> = {};
    TAX_EXPENSE_CATEGORIES.forEach((cat) => {
      result[cat] = 0;
    });
    for (const e of entriesInYear) {
      const yyyyMm = e.date.slice(0, 7);
      const kw = getKeywordsForMonth(budgetKeywords, budgetMonthExtras, yyyyMm);
      const cat = getCategoryForEntry(e.item, kw);
      const lower = e.item.trim().toLowerCase();
      if (lower.includes("부가세")) result["부가세"] += e.amount;
      else if (lower.includes("종합소득세")) result["종합소득세"] += e.amount;
      else if (lower.includes("국민연금")) result["국민연금"] += e.amount;
      else if (lower.includes("건강보험")) result["건강보험"] += e.amount;
      else if (lower.includes("사업경비") || cat === "사업경비") result["사업경비"] += e.amount;
      else if (lower.includes("자동차세") || lower.includes("면허세")) result["기타"] += e.amount;
    }
    return result;
  }, [budgetEntries, incomeYear, budgetKeywords, budgetMonthExtras]);

  /** 세금 및 경비 항목 총합 (해당 연도) */
  const taxExpenseTotalForYear = useMemo(
    () =>
      TAX_EXPENSE_CATEGORIES.reduce(
        (sum, cat) => sum + (budgetAmountByTaxCategory[cat] ?? 0),
        0
      ),
    [budgetAmountByTaxCategory]
  );

  /** 사업 및 경비 = 세금·경비 세부 항목 합계 (카드에 보이는 부가세/국민연금/건강보험/사업경비 등). 총 지출(고정값)과 다름 */
  const businessAndExpense = taxExpenseTotalForYear;
  /** 연 순수익 = 총 매출 - 사업 및 경비 */
  const yearNetProfit = yearIncomeTotal - businessAndExpense;
  /** 월 평균 수익 = 연 순수익 ÷ 현재 달 수(올해) 또는 12(과거 연도) */
  const currentYear = new Date().getFullYear();
  const currentMonthNum = new Date().getMonth() + 1;
  const monthsForAverage = incomeYear === currentYear ? currentMonthNum : 12;
  const monthNetProfit = monthsForAverage > 0 ? yearNetProfit / monthsForAverage : yearNetProfit;

  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredEntriesForYear.forEach((e) => {
      map[e.category] = (map[e.category] ?? 0) + e.amount;
    });
    return map;
  }, [filteredEntriesForYear]);

  /** 선택 연도 월별 수입 내역 (1~12월), 검색 시 필터 반영 */
  const incomeByMonth = useMemo(() => {
    const map: Record<number, IncomeEntry[]> = {};
    for (let m = 1; m <= 12; m++) map[m] = [];
    filteredEntriesForYear.forEach((e) => {
      map[e.month].push(e);
    });
    return map;
  }, [filteredEntriesForYear]);

  /** 월별·구분별로 묶기 (구분만 표시용) */
  const monthCategoryGroups = useMemo(() => {
    const result: Record<number, { category: string; total: number; entries: IncomeEntry[] }[]> = {};
    for (let m = 1; m <= 12; m++) {
      const entries = incomeByMonth[m] ?? [];
      const byCat: Record<string, IncomeEntry[]> = {};
      entries.forEach((e) => {
        if (!byCat[e.category]) byCat[e.category] = [];
        byCat[e.category].push(e);
      });
      result[m] = Object.entries(byCat).map(([category, list]) => ({
        category,
        total: list.reduce((s, x) => s + x.amount, 0),
        entries: list,
      }));
    }
    return result;
  }, [incomeByMonth]);

  /** 선택한 연도에 실제 데이터가 있는 구분만 표시 */
  const incomeCategoriesForDisplay = useMemo(() => {
    const fromEntries = new Set(filteredEntriesForYear.map((e) => e.category));
    return [...fromEntries].sort((a, b) => a.localeCompare(b));
  }, [filteredEntriesForYear]);

  const addIncomeEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const cat = newIncomeCategory.trim();
    const item = newIncomeItem.trim();
    const amount = Number(String(newIncomeAmount).replace(/,/g, ""));
    if (!cat || !item || !Number.isFinite(amount) || amount <= 0) return;
    const id = `inc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const next: IncomeEntry[] = [
      ...incomeEntries,
      {
        id,
        year: incomeYear,
        month: incomeMonth,
        item,
        amount,
        category: cat,
      },
    ];
    setIncomeEntries(next);
    saveIncomeEntries(next).catch((e) => console.error("[income] save", e));
    setNewIncomeItem("");
    setNewIncomeAmount("");
  };

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name || categories.includes(name)) return;
    const next = [...categories, name];
    setCategories(next);
    saveIncomeCategories(next);
    setNewCategoryName("");
  };

  const removeCategory = (name: string) => {
    const next = categories.filter((c) => c !== name);
    if (next.length === 0) return;
    setCategories(next);
    saveIncomeCategories(next);
  };

  const removeIncomeEntry = (id: string) => {
    const next = incomeEntries.filter((e) => e.id !== id);
    setIncomeEntries(next);
    saveIncomeEntries(next).catch((e) => console.error("[income] save", e));
    if (editingId === id) setEditingId(null);
  };

  const updateIncomeEntry = (
    id: string,
    updates: { item?: string; amount?: number; month?: number }
  ) => {
    const next = incomeEntries.map((e) =>
      e.id !== id
        ? e
        : {
            ...e,
            ...(updates.item !== undefined && { item: updates.item }),
            ...(updates.amount !== undefined && { amount: updates.amount }),
            ...(updates.month !== undefined && { month: updates.month }),
          }
    );
    setIncomeEntries(next);
    saveIncomeEntries(next).catch((e) => console.error("[income] save", e));
    setEditingId(null);
  };

  const startEdit = (e: IncomeEntry) => {
    setEditingId(e.id);
    setEditItem(e.item);
    setEditAmount(String(e.amount));
    setEditMonth(e.month);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const item = editItem.trim();
    const amount = Number(String(editAmount).replace(/,/g, ""));
    if (!item || !Number.isFinite(amount) || amount <= 0) return;
    if (editMonth < 1 || editMonth > 12) return;
    updateIncomeEntry(editingId, { item, amount, month: editMonth });
  };

  const getIncomeEntriesForExport = useCallback(() => {
    if (exportRange === "year") {
      return incomeEntries.filter((e) => e.year === exportYear);
    }
    if (exportRange === "month") {
      return incomeEntries.filter(
        (e) => e.year === exportYear && e.month === exportMonth
      );
    }
    if (exportRange === "range") {
      const fromYm = exportRangeFrom.slice(0, 7);
      const toYm = exportRangeTo.slice(0, 7);
      return incomeEntries.filter((e) => {
        const ym = `${e.year}-${String(e.month).padStart(2, "0")}`;
        return ym >= fromYm && ym <= toYm;
      });
    }
    if (exportRange === "all") {
      return incomeEntries;
    }
    return incomeEntries.filter((e) => e.year === exportYear);
  }, [incomeEntries, exportYear, exportRange, exportMonth, exportRangeFrom, exportRangeTo]);

  const runExportExcel = () => {
    const toExport = getIncomeEntriesForExport();
    const sorted = [...toExport].sort(
      (a, b) => a.year - b.year || a.month - b.month
    );
    const rows: (string | number)[][] = [["연도", "월", "구분", "항목", "금액"]];

    if (exportRange === "year" && sorted.length > 0) {
      for (let m = 1; m <= 12; m++) {
        const monthEntries = sorted.filter((e) => e.month === m);
        if (monthEntries.length === 0) continue;
        rows.push([`${exportYear}년 ${m}월`, "", "", "", ""]);
        monthEntries.forEach((e) => {
          rows.push([e.year, e.month, e.category, e.item, e.amount]);
        });
      }
    } else {
      sorted.forEach((e) => {
        rows.push([e.year, e.month, e.category, e.item, e.amount]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "수입내역");
    const suffix =
      exportRange === "year"
        ? `${exportYear}년`
        : exportRange === "month"
          ? `${exportYear}-${String(exportMonth).padStart(2, "0")}`
          : exportRange === "range"
            ? `${exportRangeFrom.slice(0, 7)}_${exportRangeTo.slice(0, 7)}`
            : "전체";
    const fileName = `수입내역_${suffix}.xlsx`;
    XLSX.writeFile(wb, fileName);
    setShowExportModal(false);
  };

  return (
    <div className="min-w-0 space-y-6">
      <SectionTitle
        title="수입"
        subtitle="연도·월별로 수입을 입력하고, 총 매출·순수익을 한눈에 보세요."
      />

      {/* 1행: 모바일=구분관리·내보내기 위 / 검색창 아래. PC=검색창 왼쪽 / 구분관리·내보내기 우측 */}
      <div className="flex flex-col flex-wrap items-stretch gap-2 sm:flex-row sm:items-center">
        <div className="order-1 flex gap-2 sm:order-2 sm:ml-auto">
          <button
            type="button"
            onClick={() => setShowCategoryModal(true)}
            className="shrink-0 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            구분 관리
          </button>
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="shrink-0 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            내보내기
          </button>
        </div>
        <div className="order-2 flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:order-1 sm:min-w-[180px] md:max-w-md">
          <div className="relative flex min-w-0 flex-1 items-center">
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
              placeholder="구분, 항목으로 검색"
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
            <span className="text-sm text-neutral-500">
              검색 결과 <strong className="text-neutral-700">{filteredEntriesForYear.length}</strong>건
            </span>
          )}
        </div>
      </div>

      {/* 2행: 연도 선택. 모바일=올해+이전(펼치면 25~21), PC=전체 버튼 */}
      <div className="sm:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIncomeYear(currentYear)}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              incomeYear === currentYear
                ? "bg-neutral-800 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            올해
          </button>
          <button
            type="button"
            onClick={() => setShowPastYearsMobile((v) => !v)}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
            aria-expanded={showPastYearsMobile}
          >
            이전
          </button>
        </div>
        {showPastYearsMobile && (
          <div className="mt-2 flex flex-wrap gap-2">
            {YEARS.filter((y) => y < currentYear).map((y) => {
              const isSelected = incomeYear === y;
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => setIncomeYear(y)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    isSelected
                      ? "bg-neutral-600 text-white/95"
                      : "bg-neutral-100/70 text-neutral-500/80 hover:bg-neutral-200/80"
                  }`}
                >
                  {y}년
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="hidden gap-2 sm:flex sm:flex-wrap sm:justify-start">
        {YEARS.map((y) => {
          const isPastYear = y < currentYear;
          const isSelected = incomeYear === y;
          return (
            <button
              key={y}
              type="button"
              onClick={() => setIncomeYear(y)}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                isSelected
                  ? isPastYear
                    ? "bg-neutral-600 text-white/95"
                    : "bg-neutral-800 text-white"
                  : isPastYear
                    ? "bg-neutral-100/70 text-neutral-500/80 hover:bg-neutral-200/80"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {yearLabel(y, currentYear)}
            </button>
          );
        })}
      </div>

      {searchQuery.trim() && (
        <Card className="border-2 border-emerald-200 bg-emerald-50/30">
          <h3 className="text-lg font-semibold text-neutral-900">
            검색 결과 – &quot;{searchQuery.trim()}&quot;
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            {incomeYear}년 수입 중 구분·항목에 맞는 내역이에요.
          </p>
          {filteredEntriesForYear.length === 0 ? (
            <p className="mt-4 py-6 text-center text-sm text-neutral-500">
              검색어에 맞는 수입이 없어요.
            </p>
          ) : (
            <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-neutral-200 bg-white">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-neutral-100">
                  <tr className="text-left text-neutral-500">
                    <th className="px-3 py-2 font-medium">연도</th>
                    <th className="px-3 py-2 font-medium">월</th>
                    <th className="px-3 py-2 font-medium">구분</th>
                    <th className="px-3 py-2 font-medium">항목</th>
                    <th className="px-3 py-2 text-right font-medium">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntriesForYear.map((e) => (
                    <tr key={e.id} className="border-t border-neutral-100">
                      <td className="px-3 py-2 text-neutral-700">{e.year}</td>
                      <td className="px-3 py-2 text-neutral-700">{e.month}월</td>
                      <td className="px-3 py-2 text-neutral-700">{e.category}</td>
                      <td className="px-3 py-2 text-neutral-800">{e.item}</td>
                      <td className="px-3 py-2 text-right font-medium text-neutral-900">
                        {formatNum(e.amount)}원
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 px-5 py-4">
            <div className="text-[15px] font-medium uppercase tracking-wider text-neutral-500">
              총 매출
            </div>
            <div className="mt-2 text-[25px] font-bold tracking-tight text-neutral-900">
              <AmountToggle amount={yearIncomeTotal} />
            </div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 px-5 py-4">
            <div className="text-[15px] font-medium uppercase tracking-wider text-neutral-500">
              연 순수익 (총매출 - 사업 및 경비)
            </div>
            <div className="mt-2 text-[25px] font-bold tracking-tight">
              <AmountToggle
                amount={yearNetProfit}
                variant={yearNetProfit >= 0 ? "profit" : "loss"}
              />
            </div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 px-5 py-4">
            <div className="text-[15px] font-medium uppercase tracking-wider text-neutral-500">
              월 평균수익 (연 순수익 ÷ {monthsForAverage})
            </div>
            <div className="mt-2 text-[25px] font-bold tracking-tight">
              <AmountToggle
                amount={Math.round(monthNetProfit)}
                variant={monthNetProfit >= 0 ? "profit" : "loss"}
              />
            </div>
          </div>
        </div>
        <form onSubmit={addIncomeEntry} className="mt-8 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-500">월</label>
            <div className="relative mt-1 inline-block min-w-[88px]">
              <select
                value={incomeMonth}
                onChange={(e) => setIncomeMonth(Number(e.target.value))}
                className="block w-full appearance-none rounded-lg border border-neutral-200 bg-white py-2 pl-3 pr-9 text-sm text-neutral-800"
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500">구분</label>
            <div className="relative mt-1 inline-block min-w-[120px]">
              <select
                value={newIncomeCategory}
                onChange={(e) => setNewIncomeCategory(e.target.value)}
                className="block w-full appearance-none rounded-lg border border-neutral-200 bg-white py-2 pl-3 pr-9 text-sm text-neutral-800"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </div>
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-neutral-500">항목</label>
            <input
              type="text"
              value={newIncomeItem}
              onChange={(e) => setNewIncomeItem(e.target.value)}
              placeholder="항목명"
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs font-medium text-neutral-500">금액</label>
            <input
              type="number"
              min={1}
              value={newIncomeAmount}
              onChange={(e) => setNewIncomeAmount(e.target.value)}
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
        <p className="mt-2 text-xs text-neutral-500">금액 입력 후 Enter로 추가할 수 있어요.</p>
      </Card>

      <Card>
        <h3 className="text-3xl font-semibold text-neutral-900">월별 수입 한눈에</h3>
        <p className="mt-1 text-sm text-neutral-500">
          {incomeYear}년 월별로 클릭하면 상세 내역 모달이 열려요.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MONTHS.map((m) => {
            const groups = monthCategoryGroups[m] ?? [];
            const total = groups.reduce((s, g) => s + g.total, 0);
            const isCurrentMonth =
              incomeYear === new Date().getFullYear() &&
              m === new Date().getMonth() + 1;
            return (
              <div
                key={m}
                className={`rounded-xl bg-neutral-50/50 ${
                  isCurrentMonth
                    ? "border-2 border-black"
                    : "border border-neutral-200"
                }`}
              >
                <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5">
                  <span className="font-semibold text-neutral-800">{m}월</span>
                  <span className="text-sm font-bold text-emerald-700">
                    {formatNum(total)}원
                  </span>
                </div>
                <ul className="min-h-[2.5rem] px-4 py-2">
                  {groups.length === 0 ? (
                    <li className="py-2 text-center text-sm text-neutral-400">
                      수입 없음
                    </li>
                  ) : (
                    groups.map(({ category, total: catTotal }) => {
                      return (
                        <li
                          key={`${m}-${category}`}
                          className="border-b border-neutral-100 last:border-0"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setDetailModal({ month: m, category })
                            }
                            className="flex w-full items-center justify-between gap-3 py-2 pl-2 pr-3 text-left transition hover:bg-neutral-100/80"
                          >
                            <span className="font-medium text-neutral-500">
                              {category}
                            </span>
                            <span className="text-sm font-semibold text-emerald-600/90">
                              {formatNum(catTotal)}원
                            </span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="text-[28px] font-semibold text-neutral-900">수입 항목</h3>
          <p className="mt-1 text-sm text-neutral-500">
            {incomeYear}년 구분별 수입이에요. 새 구분을 추가하면 여기에 반영돼요.
          </p>
          <ul className="mt-4 space-y-2">
            {incomeCategoriesForDisplay.map((cat) => (
              <li
                key={cat}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3"
              >
                <span className="font-medium text-neutral-800">{cat}</span>
                <span className="text-lg font-semibold text-emerald-700">
                  {formatNum(incomeByCategory[cat] ?? 0)}원
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-3">
            <span className="font-semibold text-neutral-800">총합</span>
            <span className="text-xl font-bold text-emerald-700">
              {formatNum(yearIncomeTotal)}원
            </span>
          </div>
        </Card>

        <Card>
          <h3 className="text-[28px] font-semibold text-neutral-900">세금 및 경비</h3>
          <p className="mt-1 text-sm text-neutral-500">
            {incomeYear}년 사업 및 경비 세부 내역이에요. 연 순수익 = 총매출 - 아래 합계.
          </p>
          <ul className="mt-4 space-y-2">
            {TAX_EXPENSE_CATEGORIES.map((cat) => {
              const fromBudget = budgetAmountByTaxCategory[cat] ?? 0;
              return (
                <li
                  key={cat}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3"
                >
                  <span className="font-medium text-neutral-800">{cat}</span>
                  <span className="font-medium text-red-600">
                    {formatNum(fromBudget)}원
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center justify-between rounded-xl border-2 border-neutral-200 bg-neutral-50 px-4 py-3">
            <span className="font-semibold text-neutral-800">사업 및 경비 합계</span>
            <span className="text-xl font-bold text-red-600">
              {formatNum(taxExpenseTotalForYear)}원
            </span>
          </div>
        </Card>
      </div>

      {/* 내보내기 모달 (body에 포탈 → 화면 전체 어둡게) */}
      {showExportModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center overflow-y-auto bg-black/55 p-4"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={() => setShowExportModal(false)}
          >
            <div
              className="my-auto w-full max-w-md shrink-0 rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-neutral-900">수입 내보내기</h3>
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
{YEARS.map((y) => (
                  <option key={y} value={y}>{yearLabel(y, currentYear)}</option>
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
                    {MONTHS.map((m) => (
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
                <strong>{getIncomeEntriesForExport().length}</strong>건 내보내기
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

      {detailModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-screen min-w-full items-center justify-center overflow-y-auto bg-black/40 p-4"
            onClick={() => {
              setDetailModal(null);
              setEditingId(null);
            }}
          >
            <div
              className="my-auto w-full max-w-2xl max-h-[85vh] shrink-0 overflow-hidden rounded-2xl bg-white shadow-xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="border-b border-neutral-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-neutral-900">
                {incomeYear}년 {detailModal.month}월 – {detailModal.category}
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                항목·금액·월을 확인하고 수정·삭제할 수 있어요.
              </p>
            </div>
            <div className="flex-1 overflow-auto px-5 py-4">
              {(() => {
                const entries = filteredEntriesForYear.filter(
                  (e) =>
                    e.month === detailModal.month &&
                    e.category === detailModal.category
                );
                if (entries.length === 0) {
                  return (
                    <p className="py-8 text-center text-sm text-neutral-500">
                      내역이 없어요.
                    </p>
                  );
                }
                return (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-left text-neutral-500">
                        <th className="pb-2 pr-3 font-medium">월</th>
                        <th className="pb-2 pr-3 font-medium">항목</th>
                        <th className="pb-2 pr-3 font-medium text-right">금액</th>
                        <th className="pb-2 w-24 font-medium"> </th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e) => {
                        const isEditing = editingId === e.id;
                        return (
                          <tr
                            key={e.id}
                            className="border-b border-neutral-100 align-top"
                          >
                            <td className="py-2.5 pr-3">
                              {isEditing ? (
                                <select
                                  value={editMonth}
                                  onChange={(ev) =>
                                    setEditMonth(Number(ev.target.value))
                                  }
                                  className="rounded border border-neutral-200 px-2 py-1.5 text-neutral-800"
                                >
                                  {MONTHS.map((mo) => (
                                    <option key={mo} value={mo}>
                                      {mo}월
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-neutral-600">{e.month}월</span>
                              )}
                            </td>
                            <td className="py-2.5 pr-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editItem}
                                  onChange={(e) => setEditItem(e.target.value)}
                                  className="w-full rounded border border-neutral-200 px-2 py-1.5 text-neutral-800"
                                />
                              ) : (
                                <span className="text-neutral-800">{e.item}</span>
                              )}
                            </td>
                            <td className="py-2.5 pr-3 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min={1}
                                  value={editAmount}
                                  onChange={(e) => setEditAmount(e.target.value)}
                                  className="w-28 rounded border border-neutral-200 px-2 py-1.5 text-right text-neutral-800"
                                />
                              ) : (
                                <span className="font-medium text-neutral-800">
                                  {formatNum(e.amount)}원
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 w-24">
                              {isEditing ? (
                                <span className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={saveEdit}
                                    className="rounded bg-neutral-800 px-2 py-1 text-xs font-medium text-white hover:bg-neutral-700"
                                  >
                                    저장
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    className="rounded bg-neutral-200 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-300"
                                  >
                                    취소
                                  </button>
                                </span>
                              ) : (
                                <span className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => startEdit(e)}
                                    className="rounded bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                                  >
                                    수정
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeIncomeEntry(e.id)}
                                    className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                                  >
                                    삭제
                                  </button>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
            <div className="flex justify-end border-t border-neutral-200 px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  setDetailModal(null);
                  setEditingId(null);
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

      {showCategoryModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-[100dvh] min-w-[100vw] items-center justify-center overflow-y-auto bg-black/40 p-4"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={() => {
              setShowCategoryModal(false);
              setNewCategoryName("");
            }}
          >
            <div
              className="my-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-neutral-900">구분 관리</h3>
              <p className="mt-1 text-sm text-neutral-500">
                수입 구분을 추가하거나 삭제할 수 있어요.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-neutral-700"
                  >
                    {c}
                    <button
                      type="button"
                      onClick={() => removeCategory(c)}
                      className="text-neutral-400 hover:text-red-600"
                      aria-label={`${c} 삭제`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="새 구분 이름"
                  className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
                />
                <button
                  type="button"
                  onClick={addCategory}
                  className="rounded-xl bg-neutral-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
                >
                  추가
                </button>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false);
                    setNewCategoryName("");
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
    </div>
  );
}
