/**
 * 메모: 포스트잇 형태.
 * Supabase 연결 시 DB 사용(기기/모바일 동기화), 없으면 localStorage
 */

import { supabase } from "./supabase";

const MEMO_KEY = "my-lifestyle-memos";

export type MemoColorId =
  | "black"
  | "wine"
  | "purple";

export type Memo = {
  id: string;
  content: string;
  createdAt: string; // ISO
  color: MemoColorId;
  pinned?: boolean;
  /** 고정(별) 누른 시각(ISO). 홈 노출 순서에 사용 */
  pinnedAt?: string;
  title?: string;
  /** 휴지통 이동 시각(ISO). 있으면 휴지통에 있음 */
  deletedAt?: string;
  /** 절대 위치(px). 없으면 그리드 기본값 적용 */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export const MEMO_DEFAULT_WIDTH = 320;
export const MEMO_DEFAULT_HEIGHT = 320;
export const MEMO_MIN_WIDTH = 220;
export const MEMO_MIN_HEIGHT = 220;

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

function rowToMemo(row: Record<string, unknown>): Memo {
  return {
    id: String(row.id),
    content: String(row.content ?? ""),
    createdAt: row.created_at ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
    color: (row.color as MemoColorId) ?? "black",
    pinned: Boolean(row.pinned),
    pinnedAt: row.pinned_at ? new Date(row.pinned_at as string).toISOString() : undefined,
    title: row.title != null ? String(row.title) : undefined,
    deletedAt: row.deleted_at ? new Date(row.deleted_at as string).toISOString() : undefined,
    x: row.x != null ? Number(row.x) : undefined,
    y: row.y != null ? Number(row.y) : undefined,
    width: row.width != null ? Number(row.width) : undefined,
    height: row.height != null ? Number(row.height) : undefined,
  };
}

function memoToRow(m: Memo): Record<string, unknown> {
  return {
    id: m.id,
    content: m.content,
    created_at: m.createdAt,
    color: m.color,
    pinned: m.pinned ?? false,
    pinned_at: m.pinnedAt ?? null,
    title: m.title ?? null,
    deleted_at: m.deletedAt ?? null,
    x: m.x ?? null,
    y: m.y ?? null,
    width: m.width ?? null,
    height: m.height ?? null,
  };
}

function loadAllFromStorage(): Memo[] {
  const data = loadJson<Memo[]>(MEMO_KEY, []);
  return Array.isArray(data) ? data : [];
}

/** 전체 메모 로드 (Supabase 또는 localStorage). 휴지통 포함 */
export async function loadAllMemos(): Promise<Memo[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("memos")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[memoDb] loadAllMemos", error);
      return loadAllFromStorage();
    }
    const fromDb = (data ?? []).map((row) => rowToMemo(row));
    // 한 번만: Supabase는 비어 있는데 이 기기 localStorage에 메모가 있으면 올리기
    if (fromDb.length === 0) {
      const fromStorage = loadAllFromStorage();
      if (fromStorage.length > 0) {
        await saveMemos(fromStorage);
        return fromStorage;
      }
    }
    return fromDb;
  }
  return loadAllFromStorage();
}

/** 일반 메모만 (휴지통 제외) */
export async function loadMemos(): Promise<Memo[]> {
  const all = await loadAllMemos();
  return all.filter((m) => !m.deletedAt);
}

/** 휴지통에 있는 메모만 */
export async function loadTrashMemos(): Promise<Memo[]> {
  const all = await loadAllMemos();
  return all.filter((m) => !!m.deletedAt);
}

/** 메모 전체 저장 (Supabase 또는 localStorage). Supabase 시 기존 중 목록에 없는 행은 삭제 */
export async function saveMemos(memos: Memo[]): Promise<void> {
  if (supabase) {
    const ourIds = new Set(memos.map((m) => m.id));
    const { data: existing } = await supabase.from("memos").select("id");
    const toDelete = (existing ?? []).map((r) => r.id).filter((id) => !ourIds.has(id));
    if (toDelete.length > 0) {
      await supabase.from("memos").delete().in("id", toDelete);
    }
    const rows = memos.map((m) => memoToRow(m));
    const { error } = await supabase.from("memos").upsert(rows, { onConflict: "id" });
    if (error) {
      console.error("[memoDb] saveMemos", error);
    }
    return;
  }
  saveJson(MEMO_KEY, memos);
}

/** 메모 목록만 갱신(휴지통 항목은 유지). 위치 등 기본값 보정 시 사용 */
export async function saveMemosOnlyUpdate(updatedMemos: Memo[]): Promise<void> {
  const all = await loadAllMemos();
  const updatedIds = new Set(updatedMemos.map((m) => m.id));
  const rest = all.filter((m) => !updatedIds.has(m.id));
  await saveMemos([...updatedMemos, ...rest]);
}

/** 메모를 휴지통으로 이동 */
export async function moveMemoToTrash(id: string): Promise<void> {
  const all = await loadAllMemos();
  const next = all.map((m) =>
    m.id === id ? { ...m, deletedAt: new Date().toISOString() } : m
  );
  await saveMemos(next);
}

/** 휴지통에서 복원 */
export async function restoreMemo(id: string): Promise<void> {
  const all = await loadAllMemos();
  const next = all.map((m) => (m.id === id ? { ...m, deletedAt: undefined } : m));
  await saveMemos(next);
}

/** 휴지통에서 완전 삭제 */
export async function permanentDeleteMemo(id: string): Promise<void> {
  const all = await loadAllMemos();
  await saveMemos(all.filter((m) => m.id !== id));
}

export function createMemo(color: MemoColorId = "black"): Memo {
  return {
    id: `memo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    content: "",
    createdAt: new Date().toISOString(),
    color,
    pinned: false,
    x: 20,
    y: 20,
    width: MEMO_DEFAULT_WIDTH,
    height: MEMO_DEFAULT_HEIGHT,
  };
}

/** 헤더/배경 색상 (hex). headerFg 있으면 어두운 헤더용 밝은 글자색 */
export const MEMO_COLORS: Record<
  MemoColorId,
  {
    headerBg: string;
    bodyBg: string;
    border: string;
    label: string;
    headerFg?: string;
  }
> = {
  black: {
    headerBg: "#222222",
    bodyBg: "#f3f4f6",
    border: "#333333",
    label: "블랙",
    headerFg: "#f3f4f6",
  },
  wine: {
    headerBg: "#7f1d1d",
    bodyBg: "#fef2f2",
    border: "#991b1b",
    label: "와인",
    headerFg: "#fef2f2",
  },
  purple: {
    headerBg: "#581c87",
    bodyBg: "#faf5ff",
    border: "#6b21a8",
    label: "퍼플",
    headerFg: "#f5f3ff",
  },
};
