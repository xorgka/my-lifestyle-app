/**
 * 가계부: 일별 지출 입력, 카테고리 키워드, 월별/주간 집계
 * - 월 총 지출에서 '적금','IRP','ISA','주택청약' 제외
 * - Supabase 연결 시 DB 사용, 없으면 localStorage
 */

import { localDateStr, todayStr as todayStrFromUtil } from "./dateUtil";
import { supabase } from "./supabase";
import {
  loadEntriesFromDb,
  saveEntriesToDb,
  insertEntryToDb,
  loadKeywordsFromDb,
  saveKeywordsToDb,
  loadMonthExtrasFromDb,
  saveMonthExtrasToDb,
  loadEntryDetailsFromDb,
  saveEntryDetailsToDb,
} from "./budgetDb";

export const BUDGET_ENTRIES_KEY = "my-lifestyle-budget-entries";
export const BUDGET_KEYWORDS_KEY = "my-lifestyle-budget-keywords";
export const BUDGET_MONTH_EXTRAS_KEY = "my-lifestyle-budget-month-extras";
export const BUDGET_ENTRY_DETAILS_KEY = "my-lifestyle-budget-entry-details";

export type CategoryId = "고정비" | "사업경비" | "세금" | "생활비" | "기타";

/** 카테고리 + 미분류(카드 세부 미기입 분) 표시용 */
export type DisplayCategoryId = CategoryId | "미분류";

export const CATEGORY_LABELS: Record<DisplayCategoryId, string> = {
  고정비: "고정비",
  사업경비: "사업경비",
  세금: "세금·공과금",
  생활비: "생활비",
  기타: "기타",
  미분류: "미분류",
};

/** 월 총 지출에서 제외할 키워드 (적금·IRP·ISA·주택청약) */
export const EXCLUDE_FROM_MONTH_TOTAL: string[] = [
  "적금",
  "IRP",
  "ISA",
  "주택청약",
];

/** 기본 카테고리별 키워드 (사용자가 추가/편집 가능) */
export const DEFAULT_KEYWORDS: Record<CategoryId, string[]> = {
  고정비: [
    "건강보험",
    "국민연금",
    "주택청약",
    "적금",
    "IRP",
    "ISA",
    "보험",
    "자동차 보험",
    "통신비",
    "푸르내",
    "관리비",
    "도시가스",
  ],
  사업경비: [
    "GPT",
    "클로드",
    "젠스파크",
    "커서AI",
    "그록",
    "제미나이",
    "아임웹",
    "캡컷",
    "타입캐스트",
    "세무사",
  ],
  생활비: [
    "식비",
    "편의점",
    "강아지",
    "배달",
    "쿠팡",
    "배민",
    "컬리",
    "외식",
  ],
  세금: ["부가세", "종합소득세", "자동차세", "면허세"],
  기타: [],
};

export type BudgetEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  item: string;
  amount: number;
};

/** 카드지출 등 한 건 하위 세부. 키워드로 카테고리 분류, 나머지 = 미분류 */
export type BudgetEntryDetail = {
  id: string;
  parentId: string;
  item: string;
  amount: number;
};

export type CategoryKeywords = Record<CategoryId, string[]>;
/** 특정 월에만 적용되는 추가 키워드: { "2025-02": { 사업경비: ["노션"] } } */
export type MonthExtraKeywords = Record<string, Partial<Record<CategoryId, string[]>>>;

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/** 2021년 세금·경비 시드 (수입 페이지·순수익용). 부가세·종합소득세 0, 건강보험·국민연금만 */
export const SEED_BUDGET_2021_TAX: BudgetEntry[] = [
  { id: "seed-tax-2021-1", date: "2021-01-01", item: "건강보험", amount: 1_317_760 },
  { id: "seed-tax-2021-2", date: "2021-01-01", item: "국민연금", amount: 580_350 },
];

/** 2022년 세금·경비 시드. 종합소득세 228,470 + 2,284,790, 건강보험, 국민연금 */
export const SEED_BUDGET_2022_TAX: BudgetEntry[] = [
  { id: "seed-tax-2022-1", date: "2022-01-01", item: "종합소득세", amount: 228_470 },
  { id: "seed-tax-2022-2", date: "2022-01-01", item: "종합소득세", amount: 2_284_790 },
  { id: "seed-tax-2022-3", date: "2022-01-01", item: "건강보험", amount: 1_464_440 },
  { id: "seed-tax-2022-4", date: "2022-01-01", item: "국민연금", amount: 966_680 },
];

/** 2023년 세금·경비 시드. 종합소득세 11,335,670 + 1,133,560, 건강보험, 국민연금 */
export const SEED_BUDGET_2023_TAX: BudgetEntry[] = [
  { id: "seed-tax-2023-1", date: "2023-01-01", item: "종합소득세", amount: 11_335_670 },
  { id: "seed-tax-2023-2", date: "2023-01-01", item: "종합소득세", amount: 1_133_560 },
  { id: "seed-tax-2023-3", date: "2023-01-01", item: "건강보험", amount: 2_540_380 },
  { id: "seed-tax-2023-4", date: "2023-01-01", item: "국민연금", amount: 2_364_600 },
];

/** 2024년 세금·경비 시드 (수입 페이지 세금 및 경비용). */
export const SEED_BUDGET_2024_TAX: BudgetEntry[] = [
  { id: "seed-tax-2024-01-1", date: "2024-01-01", item: "부가세", amount: 376_810 },
  { id: "seed-tax-2024-01-2", date: "2024-01-01", item: "국민연금", amount: 1_031_860 },
  { id: "seed-tax-2024-01-3", date: "2024-01-01", item: "건강보험", amount: 1_061_540 },
  { id: "seed-tax-2024-02-1", date: "2024-02-01", item: "국민연금", amount: 107_770 },
  { id: "seed-tax-2024-02-2", date: "2024-02-01", item: "건강보험", amount: 120_380 },
  { id: "seed-tax-2024-03-1", date: "2024-03-01", item: "사업경비", amount: 206_285 },
  { id: "seed-tax-2024-04-1", date: "2024-04-01", item: "국민연금", amount: 215_540 },
  { id: "seed-tax-2024-04-2", date: "2024-04-01", item: "건강보험", amount: 240_760 },
  { id: "seed-tax-2024-04-3", date: "2024-04-01", item: "사업경비", amount: 320_062 },
  { id: "seed-tax-2024-05-1", date: "2024-05-01", item: "국민연금", amount: 107_770 },
  { id: "seed-tax-2024-05-2", date: "2024-05-01", item: "건강보험", amount: 120_380 },
  { id: "seed-tax-2024-05-3", date: "2024-05-01", item: "종합소득세", amount: 550_000 },
  { id: "seed-tax-2024-05-4", date: "2024-05-01", item: "사업경비", amount: 547_221 },
  { id: "seed-tax-2024-06-1", date: "2024-06-01", item: "사업경비", amount: 93_151 },
  { id: "seed-tax-2024-07-1", date: "2024-07-01", item: "국민연금", amount: 215_540 },
  { id: "seed-tax-2024-07-2", date: "2024-07-01", item: "건강보험", amount: 240_760 },
  { id: "seed-tax-2024-07-3", date: "2024-07-01", item: "사업경비", amount: 126_820 },
  { id: "seed-tax-2024-08-1", date: "2024-08-01", item: "사업경비", amount: 311_051 },
  { id: "seed-tax-2024-09-1", date: "2024-09-01", item: "국민연금", amount: 215_540 },
  { id: "seed-tax-2024-09-2", date: "2024-09-01", item: "건강보험", amount: 240_760 },
  { id: "seed-tax-2024-09-3", date: "2024-09-01", item: "사업경비", amount: 129_593 },
  { id: "seed-tax-2024-10-1", date: "2024-10-01", item: "국민연금", amount: 107_770 },
  { id: "seed-tax-2024-10-2", date: "2024-10-01", item: "건강보험", amount: 120_380 },
  { id: "seed-tax-2024-10-3", date: "2024-10-01", item: "사업경비", amount: 200_450 },
  { id: "seed-tax-2024-11-1", date: "2024-11-01", item: "사업경비", amount: 189_654 },
  { id: "seed-tax-2024-12-1", date: "2024-12-01", item: "국민연금", amount: 215_540 },
  { id: "seed-tax-2024-12-2", date: "2024-12-01", item: "건강보험", amount: 240_760 },
  { id: "seed-tax-2024-12-3", date: "2024-12-01", item: "사업경비", amount: 147_967 },
];

/** 2025년 세금·경비 시드 (수입 페이지 세금 및 경비용). 적용 후 가계부에 추가됨. */
export const SEED_BUDGET_2025_TAX: BudgetEntry[] = [
  { id: "seed-tax-2025-01-1", date: "2025-01-01", item: "부가세", amount: 1_814_290 },
  { id: "seed-tax-2025-01-2", date: "2025-01-01", item: "국민연금", amount: 107_770 },
  { id: "seed-tax-2025-01-3", date: "2025-01-01", item: "건강보험", amount: 22_140 },
  { id: "seed-tax-2025-01-4", date: "2025-01-01", item: "사업경비", amount: 916_938 },
  { id: "seed-tax-2025-02-1", date: "2025-02-01", item: "자동차세 면허세", amount: 312_330 },
  { id: "seed-tax-2025-02-2", date: "2025-02-01", item: "국민연금", amount: 107_770 },
  { id: "seed-tax-2025-02-3", date: "2025-02-01", item: "건강보험", amount: 22_140 },
  { id: "seed-tax-2025-02-4", date: "2025-02-01", item: "사업경비", amount: 693_486 },
  { id: "seed-tax-2025-03-1", date: "2025-03-01", item: "국민연금", amount: 107_770 },
  { id: "seed-tax-2025-03-2", date: "2025-03-01", item: "건강보험", amount: 22_140 },
  { id: "seed-tax-2025-03-3", date: "2025-03-01", item: "사업경비", amount: 405_041 },
  { id: "seed-tax-2025-04-1", date: "2025-04-01", item: "국민연금", amount: 107_770 },
  { id: "seed-tax-2025-04-2", date: "2025-04-01", item: "건강보험", amount: 22_140 },
  { id: "seed-tax-2025-04-3", date: "2025-04-01", item: "사업경비", amount: 221_896 },
  { id: "seed-tax-2025-05-1", date: "2025-05-01", item: "부가세", amount: 858_816 },
  { id: "seed-tax-2025-05-2", date: "2025-05-01", item: "사업경비", amount: 1_013_809 },
  { id: "seed-tax-2025-06-1", date: "2025-06-01", item: "국민연금", amount: 215_540 },
  { id: "seed-tax-2025-06-2", date: "2025-06-01", item: "건강보험", amount: 44_280 },
  { id: "seed-tax-2025-06-3", date: "2025-06-01", item: "사업경비", amount: 169_861 },
  { id: "seed-tax-2025-06-4", date: "2025-06-01", item: "종합소득세", amount: 277_411 },
  { id: "seed-tax-2025-07-1", date: "2025-07-01", item: "국민연금", amount: 107_770 },
  { id: "seed-tax-2025-07-2", date: "2025-07-01", item: "건강보험", amount: 22_140 },
  { id: "seed-tax-2025-07-3", date: "2025-07-01", item: "사업경비", amount: 247_095 },
  { id: "seed-tax-2025-07-4", date: "2025-07-01", item: "부가세", amount: 3_131_340 },
  { id: "seed-tax-2025-08-1", date: "2025-08-01", item: "국민연금", amount: 107_770 },
  { id: "seed-tax-2025-08-2", date: "2025-08-01", item: "건강보험", amount: 22_140 },
  { id: "seed-tax-2025-08-3", date: "2025-08-01", item: "사업경비", amount: 179_640 },
  { id: "seed-tax-2025-09-1", date: "2025-09-01", item: "국민연금", amount: 215_540 },
  { id: "seed-tax-2025-09-2", date: "2025-09-01", item: "건강보험", amount: 44_280 },
  { id: "seed-tax-2025-09-3", date: "2025-09-01", item: "사업경비", amount: 405_769 },
  { id: "seed-tax-2025-10-1", date: "2025-10-01", item: "국민연금", amount: 107_770 },
  { id: "seed-tax-2025-10-2", date: "2025-10-01", item: "건강보험", amount: 22_140 },
  { id: "seed-tax-2025-10-3", date: "2025-10-01", item: "사업경비", amount: 2_776_555 },
  { id: "seed-tax-2025-10-4", date: "2025-10-01", item: "부가세", amount: 1_936_000 },
  { id: "seed-tax-2025-11-1", date: "2025-11-01", item: "사업경비", amount: 156_154 },
  { id: "seed-tax-2025-12-1", date: "2025-12-01", item: "국민연금", amount: 68_060 },
  { id: "seed-tax-2025-12-2", date: "2025-12-01", item: "건강보험", amount: 215_540 },
  { id: "seed-tax-2025-12-3", date: "2025-12-01", item: "사업경비", amount: 303_148 },
];

/** 2024·2025년은 세부 입력 없이 총 지출만 사용 (2026년부터 가계부 직접 입력) */
export const ANNUAL_TOTAL_EXPENSE: Record<number, number> = {
  2024: 50_312_782,
  2025: 62_880_691,
};

export function getAnnualTotalExpense(year: number): number | undefined {
  return ANNUAL_TOTAL_EXPENSE[year];
}

export async function loadEntries(): Promise<BudgetEntry[]> {
  if (supabase) return loadEntriesFromDb();
  const data = loadJson<BudgetEntry[]>(BUDGET_ENTRIES_KEY, []);
  return Array.isArray(data) ? data : [];
}

/** 저장 후 갱신된 목록 반환 (Supabase 사용 시 새 행은 DB id로 바뀜) */
export async function saveEntries(entries: BudgetEntry[]): Promise<BudgetEntry[]> {
  if (supabase) return saveEntriesToDb(entries);
  saveJson(BUDGET_ENTRIES_KEY, entries);
  return entries;
}

/** 새 항목 하나만 추가할 때 사용. DB는 insert 1회만 함. */
export async function insertEntry(entry: BudgetEntry): Promise<BudgetEntry> {
  if (supabase) return insertEntryToDb(entry);
  const entries = await loadEntries();
  const next = [...entries, entry];
  saveJson(BUDGET_ENTRIES_KEY, next);
  return entry;
}

export async function loadKeywords(): Promise<CategoryKeywords> {
  if (supabase) return loadKeywordsFromDb();
  const data = loadJson<CategoryKeywords>(BUDGET_KEYWORDS_KEY, DEFAULT_KEYWORDS);
  const out = { ...DEFAULT_KEYWORDS };
  (Object.keys(out) as CategoryId[]).forEach((cat) => {
    if (Array.isArray(data[cat])) out[cat] = [...data[cat]];
  });
  return out;
}

export async function saveKeywords(keywords: CategoryKeywords): Promise<void> {
  if (supabase) return saveKeywordsToDb(keywords);
  saveJson(BUDGET_KEYWORDS_KEY, keywords);
}

export async function loadMonthExtras(): Promise<MonthExtraKeywords> {
  if (supabase) return loadMonthExtrasFromDb();
  const data = loadJson<MonthExtraKeywords>(BUDGET_MONTH_EXTRAS_KEY, {});
  return typeof data === "object" && data !== null ? data : {};
}

export async function saveMonthExtras(extras: MonthExtraKeywords): Promise<void> {
  if (supabase) return saveMonthExtrasToDb(extras);
  saveJson(BUDGET_MONTH_EXTRAS_KEY, extras);
}

export async function loadEntryDetails(): Promise<BudgetEntryDetail[]> {
  if (supabase) return loadEntryDetailsFromDb();
  const data = loadJson<BudgetEntryDetail[]>(BUDGET_ENTRY_DETAILS_KEY, []);
  return Array.isArray(data) ? data : [];
}

export async function saveEntryDetails(details: BudgetEntryDetail[]): Promise<BudgetEntryDetail[]> {
  if (supabase) return saveEntryDetailsToDb(details);
  saveJson(BUDGET_ENTRY_DETAILS_KEY, details);
  return details;
}

/** 항목명이 키워드 목록에 매칭되는지 (포함 여부) */
function matchesKeyword(item: string, keywords: string[]): boolean {
  const lower = item.trim().toLowerCase();
  return keywords.some((k) => lower.includes(k.trim().toLowerCase()));
}

/** 해당 월에 적용되는 카테고리별 키워드 (기본 + 해당 월 추가분) */
export function getKeywordsForMonth(
  keywords: CategoryKeywords,
  monthExtras: MonthExtraKeywords,
  yearMonth: string // "2025-02"
): CategoryKeywords {
  const extra = monthExtras[yearMonth];
  const result: CategoryKeywords = { ...keywords };
  (Object.keys(result) as CategoryId[]).forEach((cat) => {
    result[cat] = [...result[cat]];
    if (extra?.[cat]?.length) result[cat].push(...extra[cat]!);
  });
  return result;
}

export function getCategoryForEntry(
  item: string,
  keywordsForMonth: CategoryKeywords
): CategoryId {
  const order: CategoryId[] = ["고정비", "사업경비", "세금", "생활비", "기타"];
  for (const cat of order) {
    if (cat !== "기타" && matchesKeyword(item, keywordsForMonth[cat])) return cat;
  }
  return "기타"; // 기본: 어떤 키워드에도 안 걸리면 기타
}

/**
 * 해당 연도 세금·경비를 월별로 집계. 수입 페이지 연간 합계 + 월별 모달에 공통 사용.
 * @returns byMonth[1..12][항목명] = 금액
 */
export function getTaxExpenseByMonth(
  year: number,
  entries: BudgetEntry[],
  entryDetails: BudgetEntryDetail[],
  keywords: CategoryKeywords,
  monthExtras: MonthExtraKeywords
): Record<number, Record<string, number>> {
  const yearPrefix = String(year);
  const inYear = entries.filter((e) => e.date.startsWith(yearPrefix));
  const byMonth: Record<number, Record<string, number>> = {};
  for (let m = 1; m <= 12; m++) {
    byMonth[m] = { 부가세: 0, 종합소득세: 0, 국민연금: 0, 건강보험: 0, 사업경비: 0, 기타: 0 };
  }
  const addToMonth = (month: number, item: string, amount: number, kw: CategoryKeywords) => {
    const cat = getCategoryForEntry(item, kw);
    const lower = item.trim().toLowerCase();
    const R = byMonth[month];
    if (lower.includes("부가세")) R["부가세"] += amount;
    else if (lower.includes("종합소득세")) R["종합소득세"] += amount;
    else if (lower.includes("국민연금")) R["국민연금"] += amount;
    else if (lower.includes("건강보험")) R["건강보험"] += amount;
    else if (lower.includes("사업경비") || cat === "사업경비") R["사업경비"] += amount;
    else if (lower.includes("자동차세") || lower.includes("면허세")) R["기타"] += amount;
  };
  for (const e of inYear) {
    const month = parseInt(e.date.slice(5, 7), 10);
    if (month < 1 || month > 12) continue;
    const yyyyMm = e.date.slice(0, 7);
    const kw = getKeywordsForMonth(keywords, monthExtras, yyyyMm);
    const details = entryDetails.filter((d) => d.parentId === e.id);
    if (details.length > 0) {
      for (const d of details) {
        addToMonth(month, d.item.trim(), d.amount, kw);
      }
    } else {
      addToMonth(month, e.item, e.amount, kw);
    }
  }
  return byMonth;
}

/** 월 총 지출에서 제외할 금액인지 (적금, IRP, ISA, 주택청약) */
export function isExcludedFromMonthTotal(item: string): boolean {
  return matchesKeyword(item, EXCLUDE_FROM_MONTH_TOTAL);
}

export function todayStr(): string {
  return todayStrFromUtil();
}

export function toYearMonth(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** 이번 주 (일~토) 시작일 YYYY-MM-DD (로컬 기준) */
export function getThisWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day;
  const start = new Date(d);
  start.setDate(diff);
  return localDateStr(start);
}

/** 이번 주 끝일 (토) (로컬 기준) */
export function getThisWeekEnd(): string {
  const start = getThisWeekStart();
  const s = new Date(start + "T12:00:00");
  s.setDate(s.getDate() + 6);
  return localDateStr(s);
}
