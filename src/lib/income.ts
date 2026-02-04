/**
 * 수입: 연도·월별 항목+금액, 구분(홈페이지/애드센스 등 추가·관리 가능)
 */

export const INCOME_ENTRIES_KEY = "my-lifestyle-income-entries";
export const INCOME_CATEGORIES_KEY = "my-lifestyle-income-categories";

export const DEFAULT_INCOME_CATEGORIES = ["홈페이지", "애드센스", "쇼핑몰", "로고", "일러스트", "기타"];

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

/** 2022년 수입 시드 데이터 */
export const SEED_INCOME_2022: IncomeEntry[] = [
  { id: "seed-2022-1-1", year: 2022, month: 1, category: "애드센스", item: "수입", amount: 10_045_785 },
  { id: "seed-2022-2-1", year: 2022, month: 2, category: "기타", item: "수입", amount: 967_000 },
  { id: "seed-2022-2-2", year: 2022, month: 2, category: "애드센스", item: "수입", amount: 7_538_774 },
  { id: "seed-2022-3-1", year: 2022, month: 3, category: "기타", item: "수입", amount: 967_000 },
  { id: "seed-2022-3-2", year: 2022, month: 3, category: "애드센스", item: "수입", amount: 9_204_661 },
  { id: "seed-2022-4-1", year: 2022, month: 4, category: "기타", item: "수입", amount: 522_180 },
  { id: "seed-2022-4-2", year: 2022, month: 4, category: "애드센스", item: "수입", amount: 10_038_521 },
  { id: "seed-2022-5-1", year: 2022, month: 5, category: "기타", item: "수입", amount: 967_000 },
  { id: "seed-2022-5-2", year: 2022, month: 5, category: "애드센스", item: "수입", amount: 7_198_180 },
  { id: "seed-2022-6-1", year: 2022, month: 6, category: "애드센스", item: "수입", amount: 9_350_086 },
  { id: "seed-2022-7-1", year: 2022, month: 7, category: "기타", item: "수입", amount: 483_500 },
  { id: "seed-2022-7-2", year: 2022, month: 7, category: "애드센스", item: "수입", amount: 10_060_326 },
  { id: "seed-2022-8-1", year: 2022, month: 8, category: "기타", item: "수입", amount: 1_500_000 },
  { id: "seed-2022-8-2", year: 2022, month: 8, category: "애드센스", item: "수입", amount: 9_364_666 },
  { id: "seed-2022-9-1", year: 2022, month: 9, category: "애드센스", item: "수입", amount: 5_407_322 },
  { id: "seed-2022-10-1", year: 2022, month: 10, category: "기타", item: "수입", amount: 69_694 },
  { id: "seed-2022-10-2", year: 2022, month: 10, category: "애드센스", item: "수입", amount: 4_679_612 },
  { id: "seed-2022-11-1", year: 2022, month: 11, category: "애드센스", item: "수입", amount: 5_027_117 },
  { id: "seed-2022-12-1", year: 2022, month: 12, category: "애드센스", item: "수입", amount: 2_942_126 },
];

/** 2023년 수입 시드 데이터 */
export const SEED_INCOME_2023: IncomeEntry[] = [
  { id: "seed-2023-1-1", year: 2023, month: 1, category: "애드센스", item: "수입", amount: 719_012 },
  { id: "seed-2023-1-2", year: 2023, month: 1, category: "쇼핑몰", item: "수입", amount: 18_225 },
  { id: "seed-2023-2-1", year: 2023, month: 2, category: "애드센스", item: "수입", amount: 1_521_762 },
  { id: "seed-2023-2-2", year: 2023, month: 2, category: "쇼핑몰", item: "수입", amount: 590_845 },
  { id: "seed-2023-3-1", year: 2023, month: 3, category: "애드센스", item: "수입", amount: 924_354 },
  { id: "seed-2023-3-2", year: 2023, month: 3, category: "쇼핑몰", item: "수입", amount: -499_932 },
  { id: "seed-2023-4-1", year: 2023, month: 4, category: "애드센스", item: "수입", amount: 647_499 },
  { id: "seed-2023-4-2", year: 2023, month: 4, category: "쇼핑몰", item: "수입", amount: 1_252_435 },
  { id: "seed-2023-5-1", year: 2023, month: 5, category: "애드센스", item: "수입", amount: 1_037_003 },
  { id: "seed-2023-5-2", year: 2023, month: 5, category: "쇼핑몰", item: "수입", amount: 2_240_502 },
  { id: "seed-2023-6-1", year: 2023, month: 6, category: "애드센스", item: "수입", amount: 240_106 },
  { id: "seed-2023-6-2", year: 2023, month: 6, category: "쇼핑몰", item: "수입", amount: -1_406_393 },
  { id: "seed-2023-7-1", year: 2023, month: 7, category: "애드센스", item: "수입", amount: 437_659 },
  { id: "seed-2023-7-2", year: 2023, month: 7, category: "쇼핑몰", item: "수입", amount: -611_771 },
  { id: "seed-2023-8-1", year: 2023, month: 8, category: "쇼핑몰", item: "수입", amount: 162_953 },
  { id: "seed-2023-9-1", year: 2023, month: 9, category: "애드센스", item: "수입", amount: 830_004 },
  { id: "seed-2023-10-1", year: 2023, month: 10, category: "애드센스", item: "수입", amount: 1_020_044 },
  { id: "seed-2023-10-2", year: 2023, month: 10, category: "로고", item: "수입", amount: 498_389 },
  { id: "seed-2023-10-3", year: 2023, month: 10, category: "기타", item: "근로장려금", amount: 1_279_800 },
  { id: "seed-2023-11-1", year: 2023, month: 11, category: "애드센스", item: "수입", amount: 807_034 },
  { id: "seed-2023-12-1", year: 2023, month: 12, category: "애드센스", item: "수입", amount: 1_119_125 },
  { id: "seed-2023-12-2", year: 2023, month: 12, category: "기타", item: "일러스트", amount: 2_175_750 },
  { id: "seed-2023-12-3", year: 2023, month: 12, category: "로고", item: "수입", amount: 323_473 },
];

/** 2024년 수입 시드 데이터 */
export const SEED_INCOME_2024: IncomeEntry[] = [
  { id: "seed-2024-1-1", year: 2024, month: 1, category: "애드센스", item: "수입", amount: 882_860 },
  { id: "seed-2024-1-2", year: 2024, month: 1, category: "홈페이지", item: "수입", amount: 849_350 },
  { id: "seed-2024-2-1", year: 2024, month: 2, category: "애드센스", item: "수입", amount: 879_061 },
  { id: "seed-2024-2-2", year: 2024, month: 2, category: "홈페이지", item: "수입", amount: 3_418_465 },
  { id: "seed-2024-2-3", year: 2024, month: 2, category: "일러스트", item: "수입", amount: 734_920 },
  { id: "seed-2024-3-1", year: 2024, month: 3, category: "애드센스", item: "수입", amount: 1_191_392 },
  { id: "seed-2024-3-2", year: 2024, month: 3, category: "홈페이지", item: "수입", amount: 4_115_011 },
  { id: "seed-2024-4-1", year: 2024, month: 4, category: "애드센스", item: "수입", amount: 1_239_841 },
  { id: "seed-2024-4-2", year: 2024, month: 4, category: "홈페이지", item: "수입", amount: 4_116_987 },
  { id: "seed-2024-5-1", year: 2024, month: 5, category: "애드센스", item: "수입", amount: 897_530 },
  { id: "seed-2024-5-2", year: 2024, month: 5, category: "홈페이지", item: "수입", amount: 4_196_334 },
  { id: "seed-2024-6-1", year: 2024, month: 6, category: "애드센스", item: "수입", amount: 731_854 },
  { id: "seed-2024-6-2", year: 2024, month: 6, category: "홈페이지", item: "수입", amount: 2_822_095 },
  { id: "seed-2024-7-1", year: 2024, month: 7, category: "애드센스", item: "수입", amount: 593_988 },
  { id: "seed-2024-7-2", year: 2024, month: 7, category: "홈페이지", item: "수입", amount: 7_064_770 },
  { id: "seed-2024-8-1", year: 2024, month: 8, category: "애드센스", item: "수입", amount: 1_185_453 },
  { id: "seed-2024-8-2", year: 2024, month: 8, category: "홈페이지", item: "수입", amount: 4_978_175 },
  { id: "seed-2024-8-3", year: 2024, month: 8, category: "기타", item: "근로장려금", amount: 1_650_000 },
  { id: "seed-2024-9-1", year: 2024, month: 9, category: "애드센스", item: "수입", amount: 2_319_639 },
  { id: "seed-2024-9-2", year: 2024, month: 9, category: "홈페이지", item: "수입", amount: 3_438_352 },
  { id: "seed-2024-9-3", year: 2024, month: 9, category: "기타", item: "엄마", amount: 5_000_000 },
  { id: "seed-2024-10-1", year: 2024, month: 10, category: "애드센스", item: "수입", amount: 1_416_327 },
  { id: "seed-2024-10-2", year: 2024, month: 10, category: "홈페이지", item: "수입", amount: 2_331_200 },
  { id: "seed-2024-11-1", year: 2024, month: 11, category: "애드센스", item: "수입", amount: 952_320 },
  { id: "seed-2024-11-2", year: 2024, month: 11, category: "홈페이지", item: "수입", amount: 4_437_066 },
  { id: "seed-2024-12-1", year: 2024, month: 12, category: "애드센스", item: "수입", amount: 676_474 },
  { id: "seed-2024-12-2", year: 2024, month: 12, category: "홈페이지", item: "수입", amount: 6_727_441 },
];

/** 2025년 수입 시드 데이터 */
export const SEED_INCOME_2025: IncomeEntry[] = [
  { id: "seed-2025-1-1", year: 2025, month: 1, category: "애드센스", item: "수입", amount: 576_942 },
  { id: "seed-2025-1-2", year: 2025, month: 1, category: "홈페이지", item: "수입", amount: 6_863_209 },
  { id: "seed-2025-2-1", year: 2025, month: 2, category: "애드센스", item: "수입", amount: 523_073 },
  { id: "seed-2025-2-2", year: 2025, month: 2, category: "홈페이지", item: "수입", amount: 1_859_446 },
  { id: "seed-2025-3-1", year: 2025, month: 3, category: "애드센스", item: "수입", amount: 997_363 },
  { id: "seed-2025-3-2", year: 2025, month: 3, category: "홈페이지", item: "수입", amount: 6_334_824 },
  { id: "seed-2025-4-1", year: 2025, month: 4, category: "애드센스", item: "수입", amount: 637_354 },
  { id: "seed-2025-4-2", year: 2025, month: 4, category: "홈페이지", item: "수입", amount: 16_447_400 },
  { id: "seed-2025-5-1", year: 2025, month: 5, category: "애드센스", item: "수입", amount: 919_987 },
  { id: "seed-2025-5-2", year: 2025, month: 5, category: "홈페이지", item: "수입", amount: 15_696_513 },
  { id: "seed-2025-6-1", year: 2025, month: 6, category: "애드센스", item: "수입", amount: 606_657 },
  { id: "seed-2025-6-2", year: 2025, month: 6, category: "홈페이지", item: "수입", amount: 8_172_544 },
  { id: "seed-2025-7-1", year: 2025, month: 7, category: "애드센스", item: "수입", amount: 939_735 },
  { id: "seed-2025-7-2", year: 2025, month: 7, category: "홈페이지", item: "수입", amount: 3_908_995 },
  { id: "seed-2025-8-1", year: 2025, month: 8, category: "애드센스", item: "수입", amount: 842_804 },
  { id: "seed-2025-8-2", year: 2025, month: 8, category: "홈페이지", item: "수입", amount: 4_745_162 },
  { id: "seed-2025-9-1", year: 2025, month: 9, category: "애드센스", item: "수입", amount: 892_344 },
  { id: "seed-2025-9-2", year: 2025, month: 9, category: "홈페이지", item: "수입", amount: 3_877_511 },
  { id: "seed-2025-10-1", year: 2025, month: 10, category: "애드센스", item: "수입", amount: 465_389 },
  { id: "seed-2025-10-2", year: 2025, month: 10, category: "홈페이지", item: "수입", amount: 1_533_500 },
  { id: "seed-2025-11-1", year: 2025, month: 11, category: "애드센스", item: "수입", amount: 393_378 },
  { id: "seed-2025-11-2", year: 2025, month: 11, category: "홈페이지", item: "수입", amount: 3_178_000 },
  { id: "seed-2025-12-1", year: 2025, month: 12, category: "애드센스", item: "수입", amount: 365_212 },
  { id: "seed-2025-12-2", year: 2025, month: 12, category: "홈페이지", item: "수입", amount: 4_577_000 },
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
