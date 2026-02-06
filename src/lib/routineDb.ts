/**
 * 루틴: Supabase 연결 시 DB 사용(모바일·PC 동기화), 없으면 localStorage
 * 테이블: routine_items (id, title, sort_order), routine_completions (date, item_id)
 */

import { supabase } from "./supabase";

export type RoutineItem = {
  id: number;
  title: string;
  /** 중요 항목 여부 (별표로 표시, 이번달 탭에서 항목별 O/X 보기) */
  isImportant?: boolean;
};

const STORAGE_ITEMS = "routine-items";
const STORAGE_IMPORTANT_IDS = "routine-important-ids";
const STORAGE_DAILY = "routine-daily";
const KEEP_DAILY_MONTHS = 12;

function loadImportantIdsFromStorage(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_IMPORTANT_IDS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(Number).filter((n) => !Number.isNaN(n))) : new Set();
  } catch {
    return new Set();
  }
}

function saveImportantIdsToStorage(ids: number[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_IMPORTANT_IDS, JSON.stringify(ids));
  } catch {}
}

function getCutoffDateKey(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - KEEP_DAILY_MONTHS);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadItemsFromStorage(): RoutineItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_ITEMS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { id: number; title: string; isImportant?: boolean }[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p) => ({ id: p.id, title: p.title ?? "", isImportant: !!p.isImportant }));
  } catch {
    return [];
  }
}

function saveItemsToStorage(items: RoutineItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_ITEMS, JSON.stringify(items));
  } catch {}
}

function loadCompletionsFromStorage(): Record<string, number[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_DAILY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number[]>;
    const cutoff = getCutoffDateKey();
    const out: Record<string, number[]> = {};
    Object.entries(parsed).forEach(([key, ids]) => {
      if (key >= cutoff) out[key] = ids;
    });
    return out;
  } catch {
    return {};
  }
}

function saveCompletionsToStorage(completions: Record<string, number[]>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_DAILY, JSON.stringify(completions));
  } catch {}
}

/** 루틴 항목 로드 (NEXT_PUBLIC_SUPABASE_URL 있을 때만 routine_items 테이블 사용) */
export async function loadRoutineItems(): Promise<RoutineItem[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("routine_items")
      .select("id, title, sort_order, is_important")
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("[routineDb] loadRoutineItems", error);
      return loadItemsFromStorage();
    }
    const fromDb = (data ?? []).map((row) => ({
      id: Number(row.id),
      title: String(row.title ?? ""),
      isImportant: !!(row as { is_important?: boolean }).is_important,
    }));
    if (fromDb.length > 0) {
      const importantIds = loadImportantIdsFromStorage();
      const merged = fromDb.map((item) => ({
        ...item,
        isImportant: item.isImportant || importantIds.has(item.id),
      }));
      return merged;
    }
    const fromStorage = loadItemsFromStorage();
    if (fromStorage.length > 0) {
      const saved = await saveRoutineItems(fromStorage);
      if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_ITEMS);
      return saved;
    }
    return [];
  }
  const fromStorage = loadItemsFromStorage();
  const importantIds = loadImportantIdsFromStorage();
  return fromStorage.map((item) => ({
    ...item,
    isImportant: item.isImportant || importantIds.has(item.id),
  }));
}

/** 루틴 항목 저장. 새 항목은 DB insert 후 반환된 id로 교체되어 반환됨. */
export async function saveRoutineItems(items: RoutineItem[]): Promise<RoutineItem[]> {
  if (supabase) {
    const { data: existingRows } = await supabase
      .from("routine_items")
      .select("id")
      .order("id", { ascending: true });
    const existingIds = new Set((existingRows ?? []).map((r) => Number(r.id)));
    const result: RoutineItem[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (existingIds.has(item.id)) {
        await supabase
          .from("routine_items")
          .update({ title: item.title, sort_order: i, is_important: !!item.isImportant })
          .eq("id", item.id);
        result.push(item);
      } else {
        const { data: inserted, error } = await supabase
          .from("routine_items")
          .insert({ title: item.title, sort_order: i, is_important: !!item.isImportant })
          .select("id, title")
          .single();
        if (error) {
          console.error("[routineDb] insert item", error);
          result.push(item);
        } else {
          result.push({
            id: Number(inserted.id),
            title: inserted.title ?? item.title,
            isImportant: !!item.isImportant,
          });
        }
      }
    }
    const keepIds = new Set(result.map((r) => r.id));
    const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
    if (toDelete.length > 0) {
      await supabase.from("routine_items").delete().in("id", toDelete);
    }
    saveImportantIdsToStorage(result.filter((r) => r.isImportant).map((r) => r.id));
    return result;
  }
  saveItemsToStorage(items);
  saveImportantIdsToStorage(items.filter((i) => i.isImportant).map((i) => i.id));
  return items;
}

/** 일별 완료 기록 로드 (routine_completions 테이블, cutoff 이후만) */
export async function loadRoutineCompletions(): Promise<Record<string, number[]>> {
  const cutoff = getCutoffDateKey();
  if (supabase) {
    const { data, error } = await supabase
      .from("routine_completions")
      .select("date, item_id")
      .gte("date", cutoff);
    if (error) {
      console.error("[routineDb] loadRoutineCompletions", error);
      return loadCompletionsFromStorage();
    }
    const out: Record<string, number[]> = {};
    (data ?? []).forEach((row) => {
      const d = row.date;
      const id = Number(row.item_id);
      if (!out[d]) out[d] = [];
      out[d].push(id);
    });
    return out;
  }
  return loadCompletionsFromStorage();
}

/** 일별 완료 기록 저장 (cutoff 이후 전체 교체) */
export async function saveRoutineCompletions(completions: Record<string, number[]>): Promise<void> {
  const cutoff = getCutoffDateKey();
  if (supabase) {
    await supabase.from("routine_completions").delete().gte("date", cutoff);
    const rows: { date: string; item_id: number }[] = [];
    Object.entries(completions).forEach(([date, ids]) => {
      if (date >= cutoff) ids.forEach((item_id) => rows.push({ date, item_id }));
    });
    if (rows.length > 0) {
      const { error } = await supabase.from("routine_completions").insert(rows);
      if (error) console.error("[routineDb] saveRoutineCompletions", error);
    }
    return;
  }
  saveCompletionsToStorage(completions);
}

/** 완료 토글 (한 건만 반영, 저장 시 사용) */
export async function toggleRoutineCompletion(
  date: string,
  itemId: number,
  completed: boolean
): Promise<void> {
  if (supabase) {
    if (completed) {
      const { error } = await supabase.from("routine_completions").insert({ date, item_id: itemId });
      if (error) console.error("[routineDb] toggleCompletion insert", error);
    } else {
      const { error } = await supabase
        .from("routine_completions")
        .delete()
        .eq("date", date)
        .eq("item_id", itemId);
      if (error) console.error("[routineDb] toggleCompletion delete", error);
    }
    return;
  }
  const prev = loadCompletionsFromStorage();
  const list = prev[date] ?? [];
  if (completed) {
    if (!list.includes(itemId)) prev[date] = [...list, itemId];
  } else {
    prev[date] = list.filter((x) => x !== itemId);
  }
  saveCompletionsToStorage(prev);
}
