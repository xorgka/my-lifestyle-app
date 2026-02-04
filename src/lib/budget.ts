/**
 * 가계부: 일별 지출 입력, 카테고리 키워드, 월별/주간 집계
 * - 월 총 지출에서 '적금','IRP','ISA','주택청약' 제외
 * - Supabase 연결 시 DB 사용, 없으면 localStorage
 */

import { supabase } from "./supabase";
import {
  loadEntriesFromDb,
  saveEntriesToDb,
  loadKeywordsFromDb,
  saveKeywordsToDb,
  loadMonthExtrasFromDb,
  saveMonthExtrasToDb,
} from "./budgetDb";

export const BUDGET_ENTRIES_KEY = "my-lifestyle-budget-entries";
export const BUDGET_KEYWORDS_KEY = "my-lifestyle-budget-keywords";
export const BUDGET_MONTH_EXTRAS_KEY = "my-lifestyle-budget-month-extras";

export type CategoryId = "고정비" | "사업경비" | "세금" | "생활비" | "신용카드";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  고정비: "고정비",
  사업경비: "사업경비",
  세금: "세금",
  생활비: "생활비",
  신용카드: "신용카드",
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
  신용카드: ["악사보험", "클라우드웨이즈", "KT통신요금"],
  세금: ["부가세", "종합소득세", "자동차세", "면허세"],
};

export type BudgetEntry = {
  id: string;
  date: string; // YYYY-MM-DD
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
  const order: CategoryId[] = ["고정비", "사업경비", "세금", "생활비", "신용카드"];
  for (const cat of order) {
    if (matchesKeyword(item, keywordsForMonth[cat])) return cat;
  }
  return "생활비"; // 기본
}

/** 월 총 지출에서 제외할 금액인지 (적금, IRP, ISA, 주택청약) */
export function isExcludedFromMonthTotal(item: string): boolean {
  return matchesKeyword(item, EXCLUDE_FROM_MONTH_TOTAL);
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toYearMonth(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** 이번 주 (일~토) 시작일 YYYY-MM-DD */
export function getThisWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day;
  const start = new Date(d);
  start.setDate(diff);
  return start.toISOString().slice(0, 10);
}

/** 이번 주 끝일 (토) */
export function getThisWeekEnd(): string {
  const start = getThisWeekStart();
  const s = new Date(start + "T12:00:00");
  s.setDate(s.getDate() + 6);
  return s.toISOString().slice(0, 10);
}
