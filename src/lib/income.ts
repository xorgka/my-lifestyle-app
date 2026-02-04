/**
 * 수입: 연도·월별 항목+금액, 구분(홈페이지/애드센스 등 추가·관리 가능)
 */

export const INCOME_ENTRIES_KEY = "my-lifestyle-income-entries";
export const INCOME_CATEGORIES_KEY = "my-lifestyle-income-categories";

export const DEFAULT_INCOME_CATEGORIES = ["홈페이지", "애드센스"];

export type IncomeEntry = {
  id: string;
  year: number;
  month: number;
  item: string;
  amount: number;
  category: string;
};

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

export function loadIncomeEntries(): IncomeEntry[] {
  const data = loadJson<IncomeEntry[]>(INCOME_ENTRIES_KEY, []);
  return Array.isArray(data) ? data : [];
}

export function saveIncomeEntries(entries: IncomeEntry[]): void {
  saveJson(INCOME_ENTRIES_KEY, entries);
}

export function loadIncomeCategories(): string[] {
  const data = loadJson<string[]>(INCOME_CATEGORIES_KEY, DEFAULT_INCOME_CATEGORIES);
  if (!Array.isArray(data) || data.length === 0) return [...DEFAULT_INCOME_CATEGORIES];
  return data;
}

export function saveIncomeCategories(categories: string[]): void {
  saveJson(INCOME_CATEGORIES_KEY, categories);
}

/** 세금 및 경비 (연도별) */
export const TAX_EXPENSE_KEY = "my-lifestyle-tax-expense";
export const TAX_EXPENSE_CATEGORIES = [
  "부가세",
  "종합소득세",
  "국민연금",
  "건강보험",
  "사업경비",
  "기타",
] as const;

export type TaxExpenseByYear = Record<string, Record<string, number>>;

export function loadTaxExpense(): TaxExpenseByYear {
  const data = loadJson<TaxExpenseByYear>(TAX_EXPENSE_KEY, {});
  return typeof data === "object" && data !== null ? data : {};
}

export function saveTaxExpense(data: TaxExpenseByYear): void {
  saveJson(TAX_EXPENSE_KEY, data);
}
