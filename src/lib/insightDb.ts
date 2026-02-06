/**
 * 인사이트: Supabase 연결 시 DB 사용(기기 간 동기화), 없으면 localStorage
 */

import { supabase } from "./supabase";

export type InsightEntry = {
  id: string;
  text: string;
  createdAt: string; // ISO
};

const STORAGE_KEY = "my-lifestyle-insights";

export function loadInsightEntriesFromStorage(): InsightEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { id: number; text: string; createdAt: string }[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e) => ({
      id: String(e.id),
      text: e.text,
      createdAt: e.createdAt,
    }));
  } catch {
    return [];
  }
}

function loadFromStorage(): InsightEntry[] {
  return loadInsightEntriesFromStorage();
}

function saveToStorage(entries: InsightEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

async function fetchFromSupabase(): Promise<InsightEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("insight_entries")
    .select("id, text, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    text: row.text ?? "",
    createdAt: row.created_at ?? new Date().toISOString(),
  }));
}

export async function loadInsightEntries(): Promise<InsightEntry[]> {
  if (!supabase) return loadFromStorage();
  let fromDb: InsightEntry[] = [];
  try {
    fromDb = await fetchFromSupabase();
    // Supabase가 비어있고 로컬에 데이터가 있으면 → 로컬을 Supabase로 올리고 다시 조회
    if (fromDb.length === 0) {
      const local = loadFromStorage();
      if (local.length > 0) {
        for (const e of local) {
          const { error: insertErr } = await supabase
            .from("insight_entries")
            .insert({ text: e.text, created_at: e.createdAt });
          if (insertErr) console.error("[insight] migrate local→Supabase", e.id, insertErr);
        }
        fromDb = await fetchFromSupabase();
      }
    }
    return fromDb;
  } catch (err) {
    console.error("[insight] loadInsightEntries", err);
    try {
      fromDb = await fetchFromSupabase();
      return fromDb;
    } catch (retryErr) {
      console.error("[insight] loadInsightEntries retry", retryErr);
      return loadFromStorage();
    }
  }
}

export async function addInsightEntry(text: string): Promise<InsightEntry> {
  const createdAt = new Date().toISOString();
  if (supabase) {
    const { data, error } = await supabase
      .from("insight_entries")
      .insert({ text, created_at: createdAt })
      .select("id, text, created_at")
      .single();
    if (error) {
      console.error("[insight] addInsightEntry", error);
      const fallback: InsightEntry = { id: `local-${Date.now()}`, text, createdAt };
      const stored = loadFromStorage();
      stored.unshift(fallback);
      saveToStorage(stored);
      return fallback;
    }
    return {
      id: data.id,
      text: data.text ?? text,
      createdAt: data.created_at ?? createdAt,
    };
  }
  const entry: InsightEntry = { id: String(Date.now()), text, createdAt };
  const stored = loadFromStorage();
  stored.unshift(entry);
  saveToStorage(stored);
  return entry;
}

export async function updateInsightEntry(id: string, text: string): Promise<void> {
  if (supabase) {
    if (id.startsWith("local-")) {
      const stored = loadFromStorage();
      const idx = stored.findIndex((e) => e.id === id);
      if (idx >= 0) {
        stored[idx] = { ...stored[idx], text };
        saveToStorage(stored);
      }
      return;
    }
    const { error } = await supabase.from("insight_entries").update({ text }).eq("id", id);
    if (error) console.error("[insight] updateInsightEntry", id, error);
    return;
  }
  const stored = loadFromStorage();
  const idx = stored.findIndex((e) => e.id === id);
  if (idx >= 0) {
    stored[idx] = { ...stored[idx], text };
    saveToStorage(stored);
  }
}

export async function deleteInsightEntry(id: string): Promise<void> {
  if (supabase) {
    if (id.startsWith("local-")) {
      const stored = loadFromStorage().filter((e) => e.id !== id);
      saveToStorage(stored);
      return;
    }
    const { error } = await supabase.from("insight_entries").delete().eq("id", id);
    if (error) console.error("[insight] deleteInsightEntry", id, error);
    return;
  }
  saveToStorage(loadFromStorage().filter((e) => e.id !== id));
}
