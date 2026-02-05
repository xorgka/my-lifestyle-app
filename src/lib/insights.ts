/**
 * 투데이 인사이트 – 시스템 기본 문장
 * Supabase 연결 시 DB(insight_system_quotes) 사용, 없으면 localStorage
 */

import { supabase } from "./supabase";

export type QuoteEntry = { quote: string; author: string };

const STORAGE_KEY = "my-lifestyle-system-insights";

function loadFromStorage(): QuoteEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QuoteEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: QuoteEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export async function loadSystemInsights(defaultList: QuoteEntry[]): Promise<QuoteEntry[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("insight_system_quotes")
      .select("quote, author")
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("[insights] loadSystemInsights", error);
      return loadFromStorage().length > 0 ? loadFromStorage() : defaultList;
    }
    const fromDb = (data ?? []).map((row) => ({
      quote: String(row.quote ?? ""),
      author: String(row.author ?? ""),
    }));
    if (fromDb.length > 0) return fromDb;
    const fromStorage = loadFromStorage();
    if (fromStorage.length > 0) {
      await saveSystemInsights(fromStorage);
      if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
      return fromStorage;
    }
    return defaultList;
  }
  const stored = loadFromStorage();
  return stored.length > 0 ? stored : defaultList;
}

export async function saveSystemInsights(items: QuoteEntry[]): Promise<void> {
  if (supabase) {
    await supabase.from("insight_system_quotes").delete().gte("id", 1);
    if (items.length > 0) {
      const rows = items.map((item, i) => ({
        quote: item.quote,
        author: item.author,
        sort_order: i,
      }));
      const { error } = await supabase.from("insight_system_quotes").insert(rows);
      if (error) console.error("[insights] saveSystemInsights", error);
    }
    return;
  }
  saveToStorage(items);
}

export async function resetSystemInsightsToDefault(defaultList: QuoteEntry[]): Promise<void> {
  if (supabase) {
    await saveSystemInsights(defaultList);
    return;
  }
  saveToStorage(defaultList);
}
