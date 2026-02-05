/**
 * 투데이 인사이트 – 시스템 기본 문장 저장/불러오기
 * (수정·삭제한 내용은 localStorage에 저장, 없으면 defaultList 사용)
 */

export type QuoteEntry = { quote: string; author: string };

const STORAGE_KEY = "my-lifestyle-system-insights";

export function loadSystemInsights(defaultList: QuoteEntry[]): QuoteEntry[] {
  if (typeof window === "undefined") return defaultList;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultList;
    const parsed = JSON.parse(raw) as QuoteEntry[];
    return Array.isArray(parsed) ? parsed : defaultList;
  } catch {
    return defaultList;
  }
}

export function saveSystemInsights(items: QuoteEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export function resetSystemInsightsToDefault(defaultList: QuoteEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultList));
  } catch {}
}
