/**
 * 일기: Supabase 연결 시 DB 사용, 없으면 localStorage
 * 하루에 여러 편 쓸 수 있음 — (date, seq)가 한 편을 식별 (seq는 1부터)
 */

import { supabase } from "./supabase";

export type JournalEntry = {
  date: string;
  /** 같은 날짜 안에서 몇 번째 글인지 (1부터). 옛 데이터는 항상 1 */
  seq: number;
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
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e) => ({ ...e, seq: e.seq ?? 1 }));
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
      .select("date, seq, content, important, secret, created_at, updated_at")
      .order("date", { ascending: false })
      .order("seq", { ascending: true });
    if (error) {
      console.error("[journal] loadJournalEntries", error);
      return loadFromStorage();
    }
    return (data ?? []).map((row) => ({
      date: row.date,
      seq: row.seq ?? 1,
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
          seq: e.seq ?? 1,
          content: e.content,
          important: e.important ?? false,
          secret: e.secret ?? false,
          updated_at: e.updatedAt ?? new Date().toISOString(),
        },
        { onConflict: "date,seq" }
      );
      if (error) console.error("[journal] saveJournalEntries", e.date, e.seq, error);
    }
    return;
  }
  saveToStorage(entries.map((e) => ({ ...e, seq: e.seq ?? 1 })));
}

/** 특정 날짜의 한 편 삭제 (Supabase 또는 localStorage) */
export async function deleteJournalEntry(date: string, seq: number): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from("journal_entries").delete().eq("date", date).eq("seq", seq);
    if (error) console.error("[journal] deleteJournalEntry", date, seq, error);
    return;
  }
  const list = loadFromStorage().filter((e) => !(e.date === date && e.seq === seq));
  saveToStorage(list);
}

/** 일기 초안 스냅샷 (기기·브라우저 연동용) */
export type JournalDraftSnapshot = { content: string; important: boolean; secret?: boolean };

const DRAFTS_TABLE = "journal_drafts";

/** 초안 dict 키: 날짜별 여러 편을 구분하기 위해 date와 seq를 합침 */
export function draftKey(date: string, seq: number): string {
  return `${date}::${seq}`;
}

/** Supabase에서 일기 초안 전체 로드. 기기·브라우저 간 동기화. 반환 키는 draftKey(date, seq) */
export async function loadJournalDraftsFromSupabase(): Promise<Record<string, JournalDraftSnapshot>> {
  if (!supabase) return {};
  const { data, error } = await supabase.from(DRAFTS_TABLE).select("date, seq, content, important, secret");
  if (error) {
    console.warn("[journal] loadJournalDraftsFromSupabase", error.message);
    return {};
  }
  const out: Record<string, JournalDraftSnapshot> = {};
  (data ?? []).forEach(
    (row: { date: string; seq: number | null; content: string | null; important: boolean | null; secret: boolean | null }) => {
      out[draftKey(row.date, row.seq ?? 1)] = {
        content: row.content ?? "",
        important: row.important ?? false,
        secret: row.secret ?? false,
      };
    }
  );
  return out;
}

/** Supabase에 일기 초안 한 편 저장 또는 삭제. 기기·브라우저 간 동기화 */
export async function saveJournalDraftToSupabase(
  date: string,
  seq: number,
  snapshot: JournalDraftSnapshot | null
): Promise<void> {
  if (!supabase) return;
  if (snapshot === null) {
    await supabase.from(DRAFTS_TABLE).delete().eq("date", date).eq("seq", seq);
    return;
  }
  const { error } = await supabase.from(DRAFTS_TABLE).upsert(
    {
      date,
      seq,
      content: snapshot.content,
      important: snapshot.important ?? false,
      secret: snapshot.secret ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "date,seq" }
  );
  if (error) console.warn("[journal] saveJournalDraftToSupabase", date, seq, error.message);

  // 비밀글 토글 시 해당 (날짜,편) 일기가 이미 있으면 secret만 반영 (저장 버튼 없이도 비밀글 설정 유지)
  await supabase
    .from("journal_entries")
    .update({ secret: snapshot.secret ?? false, updated_at: new Date().toISOString() })
    .eq("date", date)
    .eq("seq", seq);
}
