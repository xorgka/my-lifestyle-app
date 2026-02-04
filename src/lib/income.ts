/**
 * 수입: 연도·월별 항목+금액, 구분(홈페이지/애드센스 등 추가·관리 가능)
 */

export const INCOME_ENTRIES_KEY = "my-lifestyle-income-entries";
export const INCOME_CATEGORIES_KEY = "my-lifestyle-income-categories";

export const DEFAULT_INCOME_CATEGORIES = ["홈페이지", "애드센스", "기타"];

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

/** 2021년 수입 시드 데이터 (저장된 데이터가 없을 때 사용) */
export const SEED_INCOME_2021: IncomeEntry[] = [
  { id: "seed-2021-1-1", year: 2021, month: 1, category: "기타", item: "수입", amount: 3_432_005 },
  { id: "seed-2021-2-1", year: 2021, month: 2, category: "기타", item: "수입", amount: 3_270_593 },
  { id: "seed-2021-3-1", year: 2021, month: 3, category: "기타", item: "수입", amount: 861_615 },
  { id: "seed-2021-3-2", year: 2021, month: 3, category: "애드센스", item: "수입", amount: 102_892 },
  { id: "seed-2021-4-1", year: 2021, month: 4, category: "기타", item: "수입", amount: 2_398_160 },
  { id: "seed-2021-4-2", year: 2021, month: 4, category: "애드센스", item: "수입", amount: 104_090 },
  { id: "seed-2021-5-1", year: 2021, month: 5, category: "기타", item: "수입", amount: 1_499_650 },
  { id: "seed-2021-5-2", year: 2021, month: 5, category: "애드센스", item: "수입", amount: 1_426_948 },
  { id: "seed-2021-6-1", year: 2021, month: 6, category: "애드센스", item: "수입", amount: 3_248_039 },
  { id: "seed-2021-8-1", year: 2021, month: 8, category: "기타", item: "수입", amount: 1_382_040 },
  { id: "seed-2021-8-2", year: 2021, month: 8, category: "애드센스", item: "수입", amount: 3_275_185 },
  { id: "seed-2021-8-3", year: 2021, month: 8, category: "애드센스", item: "수입", amount: 5_115_255 },
  { id: "seed-2021-9-1", year: 2021, month: 9, category: "기타", item: "수입", amount: 433_500 },
  { id: "seed-2021-9-2", year: 2021, month: 9, category: "애드센스", item: "수입", amount: 7_862_633 },
  { id: "seed-2021-10-1", year: 2021, month: 10, category: "기타", item: "수입", amount: 2_108_060 },
  { id: "seed-2021-10-2", year: 2021, month: 10, category: "애드센스", item: "수입", amount: 6_386_302 },
  { id: "seed-2021-11-1", year: 2021, month: 11, category: "애드센스", item: "수입", amount: 5_284_414 },
  { id: "seed-2021-12-1", year: 2021, month: 12, category: "애드센스", item: "수입", amount: 12_223_024 },
];

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
