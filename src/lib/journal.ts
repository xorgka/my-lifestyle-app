/**
 * 일기: Supabase 연결 시 DB 사용, 없으면 localStorage
 */

import { supabase } from "./supabase";

export type JournalEntry = {
  date: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  important?: boolean;
  /** 비밀글이면 달력·검색 등에서 내용 미리보기 숨김 */
  secret?: boolean;
  /** 나중에 '태그별로 보기' 확장 시 사용. content에서 #해시태그 파싱 */
  tags?: string[];
};

/** 본문에서 #해시태그 추출 (태그별로 보기 등 확장용) */
export function getTagsFromContent(content: string): string[] {
  if (!content.trim()) return [];
  const matches = content.match(/#[\w가-힣]+/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}

const STORAGE_KEY = "my-lifestyle-journal";

function loadFromStorage(): JournalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as JournalEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(entries: JournalEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

export async function loadJournalEntries(): Promise<JournalEntry[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("date, content, important, secret, created_at, updated_at")
      .order("date", { ascending: false });
    if (error) {
      console.error("[journal] loadJournalEntries", error);
      return loadFromStorage();
    }
    return (data ?? []).map((row) => ({
      date: row.date,
      content: row.content ?? "",
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? undefined,
      important: row.important ?? false,
      secret: row.secret ?? false,
    }));
  }
  return loadFromStorage();
}

export async function saveJournalEntries(entries: JournalEntry[]): Promise<void> {
  if (supabase) {
    for (const e of entries) {
      const { error } = await supabase.from("journal_entries").upsert(
        {
          date: e.date,
          content: e.content,
          important: e.important ?? false,
          secret: e.secret ?? false,
          updated_at: e.updatedAt ?? new Date().toISOString(),
        },
        { onConflict: "date" }
      );
      if (error) console.error("[journal] saveJournalEntries", e.date, error);
    }
    return;
  }
  saveToStorage(entries);
}

/** 특정 날짜 일기 삭제 (Supabase 또는 localStorage) */
export async function deleteJournalEntry(date: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from("journal_entries").delete().eq("date", date);
    if (error) console.error("[journal] deleteJournalEntry", date, error);
    return;
  }
  const list = loadFromStorage().filter((e) => e.date !== date);
  saveToStorage(list);
}

/** 일기 초안 스냅샷 (기기·브라우저 연동용) */
export type JournalDraftSnapshot = { content: string; important: boolean; secret?: boolean };

const DRAFTS_TABLE = "journal_drafts";

/** Supabase에서 일기 초안 전체 로드. 기기·브라우저 간 동기화 */
export async function loadJournalDraftsFromSupabase(): Promise<Record<string, JournalDraftSnapshot>> {
  if (!supabase) return {};
  const { data, error } = await supabase.from(DRAFTS_TABLE).select("date, content, important, secret");
  if (error) {
    console.warn("[journal] loadJournalDraftsFromSupabase", error.message);
    return {};
  }
  const out: Record<string, JournalDraftSnapshot> = {};
  (data ?? []).forEach((row: { date: string; content: string | null; important: boolean | null; secret: boolean | null }) => {
    out[row.date] = {
      content: row.content ?? "",
      important: row.important ?? false,
      secret: row.secret ?? false,
    };
  });
  return out;
}

/** Supabase에 일기 초안 한 건 저장 또는 삭제. 기기·브라우저 간 동기화 */
export async function saveJournalDraftToSupabase(date: string, snapshot: JournalDraftSnapshot | null): Promise<void> {
  if (!supabase) return;
  if (snapshot === null) {
    await supabase.from(DRAFTS_TABLE).delete().eq("date", date);
    return;
  }
  const { error } = await supabase.from(DRAFTS_TABLE).upsert(
    {
      date,
      content: snapshot.content,
      important: snapshot.important ?? false,
      secret: snapshot.secret ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "date" }
  );
  if (error) console.warn("[journal] saveJournalDraftToSupabase", date, error.message);
}
